import { createSala, getSalaById, getSala, updateSala, deleteSala } from '../models/sala.model.js';
import { catchedAsync, response } from '../middlewares/catchedAsync.js';

class SalaController {
    constructor() {}

    register = catchedAsync(async (req, res) => {
        const { title, xml, description } = req.body;
        const userId = req.user.id;
        const sala = await createSala(title, xml, description, userId);
        response(res, 201, sala);
    });

    update = catchedAsync(async (req, res) => {
        const { title, xml, description } = req.body;
        const { id } = req.params;
        
        console.log(`Controller: update request for sala ID: ${id}`);
        console.log(`Controller: received fields:`, {
            title: title ? 'yes' : 'no',
            xml: xml ? `yes (${xml.length} chars)` : 'no',
            description: description ? 'yes' : 'no'
        });
        
        if (!title && !xml && !description) {
            console.log(`❌ Controller: Petición rechazada - No hay campos para actualizar`);
            return response(res, 400, { 
                error: true, 
                message: 'Debe proporcionar al menos un campo: title, xml o description.' 
            });
        }
        
        try {
            console.log(`Controller: attempting to update sala ${id} in DB`);
            
            // 🚀 NUEVO: Pasar la instancia io para broadcast automático
            const io = req.app.get('io');
            const sala = await updateSala(id, title, xml, description, io);
            console.log(`Controller: Sala ${id} updated successfully`);
            console.log(`Controller: broadcast triggered to connected users`);
            
            response(res, 200, {
                success: true,
                message: 'Sala actualizada correctamente',
                data: sala
            });
            
        } catch (error) {
        console.error(`Controller: error updating sala ${id}:`, error.message);
            response(res, 500, { 
                error: true, 
                message: 'Error interno del servidor al actualizar la sala' 
            });
        }
    });

    getSalaById = catchedAsync(async (req, res) => {
        const { id } = req.params;
        console.log(`Controller: fetching sala with ID: ${id}`);
        
        const sala = await getSalaById(id);
        console.log(`Controller: db result for sala ${id}: rows=${sala?.length || 0}`);
        
        if (sala && sala.length > 0 && sala[0].xml) {
            console.log(`Controller: XML preview for sala ${id}:`, sala[0].xml.substring(0, 100) + '...');
        } else {
            console.log(`Controller: sala ${id} has no XML or is empty`);
        }
        response(res, 200, sala);
    });

    getSalas = catchedAsync(async (req, res) => {
        if (!req.user || !req.user.id) {
            return response(res, 401, { error: true, message: 'Unauthorized' });
        }
        const userId = req.user.id;
        const salas = await getSala(userId);
        response(res, 200, salas);
    });

    delete = catchedAsync(async (req, res) => {
        const { id } = req.params;
        const sala = await deleteSala(id);
        response(res, 200, sala);
    });
}

export default new SalaController();
