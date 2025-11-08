import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { response } from '../middlewares/catchedAsync.js';
import { getSalaById } from '../models/sala.model.js';
import { rm } from 'fs/promises';
import SpringBootProjectBuilder from '../generators/SpringBootProjectBuilder.js';

const rutaBase = 'C:/Users/Public/Documents/proyectos';

class CrearPaginaController {
  comprimirProyecto = async (titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.directory(rutaFinal, false);
      archive.finalize();
    });
  };

  enviarZip = async (res, titulo) => {
    const rutaFinal = path.join(rutaBase, titulo);
    const zipPath = path.join(rutaBase, `${titulo}.zip`);
    try {
      const zipBuffer = fs.readFileSync(zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${titulo}.zip`);
      res.send(zipBuffer);
      await rm(rutaFinal, { recursive: true, force: true });
      await rm(zipPath, { force: true });
    } catch (error) {
      console.error('❌ Error al enviar o limpiar:', error.message);
      throw error;
    }
  };

  convertirFrontendADiagramParser = (elements, connections = []) => {
    const convertedElements = {};
    (elements || []).forEach(node => {
      // Accept frontend nodes which may use 'classNode' and store data under node.data
      const isClassLike = node.type === 'class' || node.type === 'classNode' || (node.data && node.data.className);
      if (isClassLike) {
        const rawAttributes = (node.attributes && node.attributes.length) ? node.attributes : (node.data && node.data.attributes) ? node.data.attributes : [];
        const rawMethods = (node.methods && node.methods.length) ? node.methods : (node.data && node.data.methods) ? node.data.methods : [];
        const processedAttributes = (rawAttributes || []).map(attr => {
          if (typeof attr === 'string') {
            const parts = attr.replace(/^([+\-#~])?\s*/, '').split(':').map(s => s.trim());
            const name = parts[0] || 'field';
            const type = parts[1] || 'String';
            return { name, type, visibility: 'private', isPrimaryKey: name.toLowerCase() === 'id' };
          }
          return {
            name: attr.name || 'field',
            type: attr.type || 'String',
            sqlType: attr.sqlType || null,
            visibility: attr.visibility || 'private',
            isStatic: attr.isStatic || false,
            isPrimaryKey: attr.isPrimaryKey === true || (attr.name && attr.name.toLowerCase() === 'id'),
            isForeignKey: false,
            referencedEntity: attr.referencedEntity,
            referencedField: attr.referencedField,
            referencedType: attr.referencedType
          };
        });

        const hasPK = processedAttributes.some(a => a.isPrimaryKey);
        if (!hasPK) {
          processedAttributes.unshift({ name: 'id', type: 'Long', sqlType: 'BIGINT', visibility: 'private', isPrimaryKey: true, isForeignKey: false });
        }

        const resolvedName = node.name || (node.data && node.data.className) || 'Entity';

        convertedElements[node.id] = {
          id: node.id,
          name: resolvedName,
          type: 'class',
          attributes: processedAttributes,
          methods: rawMethods || [],
          stereotype: node.stereotype || (node.data && node.data.stereotype) || null,
          visibility: node.visibility || 'public',
          description: node.description || (node.data && node.data.description) || ''
        };
      }
    });

    const convertedConnections = {};
    (connections || []).forEach((edge, idx) => {
      if (edge.source && edge.target) {
        convertedConnections[`conn_${idx}`] = {
          id: `conn_${idx}`,
          type: edge.type || 'association',
          source: edge.source,
          target: edge.target,
          sourceMultiplicity: edge.sourceMultiplicity || '1',
          targetMultiplicity: edge.targetMultiplicity || '1',
          sourceName: edge.sourceName || '',
          targetName: edge.targetName || '',
          description: edge.description || ''
        };
      }
    });

    return { elements: convertedElements, connections: convertedConnections };
  };

  exportarSpringBootDesdeSala = async (req, res) => {
    const { id } = req.params;
    try {
      const [sala] = await getSalaById(id);
      if (!sala) return response(res, 404, { error: 'Sala no encontrada' });
      if (!sala.xml || sala.xml.trim() === '') return response(res, 400, { error: 'La sala no tiene contenido XML para exportar' });

      let salaData;
      try { salaData = JSON.parse(sala.xml); } catch (err) { return response(res, 400, { error: 'El XML de la sala no es válido' }); }

      // Support different shapes saved in sala.xml: older code may store { elements, connections }
      // while the frontend currently stores { nodes, edges }. Accept both.
      let elements = [];
      let connections = [];
      if (salaData.elements) {
        elements = Array.isArray(salaData.elements) ? salaData.elements : Object.values(salaData.elements);
      } else if (salaData.nodes) {
        elements = Array.isArray(salaData.nodes) ? salaData.nodes : Object.values(salaData.nodes);
      }

      if (salaData.connections) {
        connections = Array.isArray(salaData.connections) ? salaData.connections : Object.values(salaData.connections);
      } else if (salaData.edges) {
        connections = Array.isArray(salaData.edges) ? salaData.edges : Object.values(salaData.edges);
      }

      if (elements.length === 0) return response(res, 400, { error: 'No hay elementos UML en la sala para generar Spring Boot' });

      const projectName = `spring-boot-${(sala.title || 'project').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      const converted = this.convertirFrontendADiagramParser(elements, connections);
      const builder = new SpringBootProjectBuilder(projectName, JSON.stringify(converted), rutaBase);
      console.log('🚀 Iniciando generación de proyecto Spring Boot desde sala con SpringBootProjectBuilder...');
      await builder.build();
      console.log('✅ Proyecto Spring Boot generado exitosamente desde sala');
      await this.comprimirProyecto(projectName);
      await this.enviarZip(res, projectName);
    } catch (error) {
      console.error('❌ Error exportando Spring Boot desde sala:', error?.message || error);
      return response(res, 500, { error: 'Error exportando Spring Boot desde sala con SpringBootProjectBuilder', detalles: error?.message || String(error) });
    }
  };

  exportarSpringBootConRelaciones = async (req, res) => {
    // Payload-based export has been disabled. Export must be requested by sala id
    // to ensure we always use the saved/authorized diagram on the server.
    console.warn('Deprecated attempt to use payload-based Spring Boot export. This endpoint is disabled.');
    return response(res, 405, { error: 'Export by payload disabled. Use POST /apis/crearPagina/exportarSpringBoot/:id' });
  };

  parseStringAttribute = (attrString) => {
    const clean = (attrString || '').trim();
    if (!clean) return { name: 'defaultField', type: 'String', visibility: 'private', isPrimaryKey: false, isForeignKey: false, isStatic: false };
    const patterns = [/^([+\-#~])?\s*(\w+)\s*:\s*(\w+)$/, /^([+\-#~])?\s*(\w+)\s+(\w+)$/, /^(\w+)\s*:\s*(\w+)$/, /^(\w+)\s+(\w+)$/, /^(\w+)$/];
    let match = null; let idx = -1;
    for (let i=0;i<patterns.length;i++){ match = clean.match(patterns[i]); if(match){ idx=i; break; }}
    let visibility='private', name='field', type='String';
    if (match) {
      switch(idx){
        case 0: visibility = this.getVisibilityFromSymbol(match[1]||'+'); name = this.normalizeJavaFieldName(match[2]); type = this.mapJavaType(match[3]); break;
        case 1: visibility = this.getVisibilityFromSymbol(match[1]||'+'); type = this.mapJavaType(match[2]); name = this.normalizeJavaFieldName(match[3]); break;
        case 2: name = this.normalizeJavaFieldName(match[1]); type = this.mapJavaType(match[2]); break;
        case 3: type = this.mapJavaType(match[1]); name = this.normalizeJavaFieldName(match[2]); break;
        case 4: name = this.normalizeJavaFieldName(match[1]); break;
      }
    }
    return { name, type, visibility, isPrimaryKey: name.toLowerCase()==='id', isForeignKey:false, isStatic:false };
  };

  normalizeJavaFieldName = (name) => {
    if (!name || typeof name !== 'string') return 'defaultField';
    let normalized = name.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!normalized) return 'defaultField';
    if (!/^[a-zA-Z]/.test(normalized)) normalized = 'field' + normalized;
    const javaKeywords = ['abstract','boolean','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','extends','final','finally','float','for','goto','if','implements','import','instanceof','int','interface','long','native','new','package','private','protected','public','return','short','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','void','volatile','while'];
    if (javaKeywords.includes(normalized.toLowerCase())) normalized += 'Field';
    return normalized;
  };

  getVisibilityFromSymbol = (symbol) => ({ '+':'public','-':'private','#':'protected','~':'package' }[symbol] || 'private');

  mapJavaType = (type) => {
    const map = { 'string':'String','String':'String','int':'Integer','Integer':'Integer','long':'Long','Long':'Long','double':'Double','Double':'Double','float':'Float','Float':'Float','boolean':'Boolean','Boolean':'Boolean','bool':'Boolean','date':'LocalDateTime','Date':'LocalDateTime','LocalDateTime':'LocalDateTime','BigDecimal':'BigDecimal','UUID':'UUID' };
    return map[type] || 'String';
  };

  capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // Legacy-compatible generic export endpoint: if :id provided, export from sala; otherwise use payload
  exportar = async (req, res) => {
    const { id } = req.params || {};
    try {
      if (id) return await this.exportarSpringBootDesdeSala(req, res);
      // Do not accept payload-based exports anymore — require id
      console.warn('Generic export endpoint called without id — payload export disabled');
      return response(res, 405, { error: 'Export by payload disabled. Use POST /apis/crearPagina/exportarSpringBoot/:id' });
    } catch (err) {
      console.error('❌ Error in generic export endpoint:', err);
      return response(res, 500, { error: 'Error en export genérico', detalles: err?.message || String(err) });
    }
  };
}

export default new CrearPaginaController();
