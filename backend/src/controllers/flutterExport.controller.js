import path from 'path';
import FlutterProjectBuilder from '../generators/FlutterProjectBuilder.js';
import { getSalaById } from '../models/sala.model.js';
import CrearPaginaController from './crearPagina.controller.clean.js';
import { response } from '../middlewares/catchedAsync.js';

// NOTE: Este valor debe coincidir con la ruta usada por CrearPaginaController
// donde se almacenan proyectos generados temporalmente.
const rutaBase = 'C:/Users/Public/Documents/proyectos';

const FlutterExportController = {
  // Genera un proyecto Flutter a partir de la sala guardada con id
  exportarDesdeSala: async (req, res) => {
    const { id } = req.params || {};
    try {
      const [sala] = await getSalaById(id);
      if (!sala) return response(res, 404, { error: 'Sala no encontrada' });
      if (!sala.xml || sala.xml.trim() === '') return response(res, 400, { error: 'La sala no tiene contenido XML para exportar' });

      let salaData;
      try { salaData = JSON.parse(sala.xml); } catch (err) { return response(res, 400, { error: 'El XML de la sala no es válido' }); }

      let elements = [];
      let connections = [];
      // Support both formats: { elements, connections } and legacy { nodes, edges }
      if (salaData.elements) {
        elements = Array.isArray(salaData.elements) ? salaData.elements : Object.values(salaData.elements);
      } else if (salaData.nodes) {
        // frontend stores diagram as nodes/edges in some cases
        elements = Array.isArray(salaData.nodes) ? salaData.nodes : Object.values(salaData.nodes);
      }

      if (salaData.connections) {
        connections = Array.isArray(salaData.connections) ? salaData.connections : Object.values(salaData.connections);
      } else if (salaData.edges) {
        connections = Array.isArray(salaData.edges) ? salaData.edges : Object.values(salaData.edges);
      }

      if (elements.length === 0) return response(res, 400, { error: 'No hay elementos UML en la sala para generar Flutter' });

      const projectName = `flutter-project-${(sala.title || 'project').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Convertir formato frontend -> parser interno (reusa función de CrearPaginaController)
      const converted = CrearPaginaController.convertirFrontendADiagramParser(elements, connections);

  const builder = new FlutterProjectBuilder(projectName, JSON.stringify(converted), rutaBase);
      console.log('🚀 Iniciando generación de proyecto Flutter desde sala con FlutterProjectBuilder...');
      await builder.build();
      console.log('✅ Proyecto Flutter generado exitosamente desde sala');

      // Reusar la lógica de compresión y envío del controlador de CrearPaginaController
      // Nota: FlutterProjectBuilder crea la carpeta con sufijo "_flutter"
      const folderName = `${builder.projectName}_flutter`;

      

      await CrearPaginaController.comprimirProyecto(folderName);
      await CrearPaginaController.enviarZip(res, folderName);
    } catch (error) {
      console.error('❌ Error exportando Flutter desde sala:', error?.message || error);
      return response(res, 500, { error: 'Error exportando Flutter desde sala', detalles: error?.message || String(error) });
    }
  },

  // Genera un proyecto Flutter a partir del payload (elements, connections) enviado en body
  exportarConPayload: async (req, res) => {
    const { elements, connections } = req.body || {};
    if (!elements || elements.length === 0) return response(res, 400, { error: 'No hay elementos para generar el proyecto Flutter' });
    try {
      const projectName = `flutter-project-${Date.now()}`;
      const converted = CrearPaginaController.convertirFrontendADiagramParser(elements, connections || []);
  const builder = new FlutterProjectBuilder(projectName, JSON.stringify(converted), rutaBase);
  console.log('🚀 Iniciando generación de proyecto Flutter con FlutterProjectBuilder...');
  await builder.build();
  console.log('✅ Proyecto Flutter generado exitosamente');
  const folderName = `${builder.projectName}_flutter`;
  await CrearPaginaController.comprimirProyecto(folderName);
  await CrearPaginaController.enviarZip(res, folderName);
    } catch (error) {
      console.error('❌ Error generando proyecto Flutter:', error?.message || error);
      return response(res, 500, { error: 'Error generando proyecto Flutter', detalles: error?.message || String(error) });
    }
  }
};

export default FlutterExportController;
