import { Router } from 'express';
import CrearPaginaController from '../controllers/crearPagina.controller.js';
import FlutterExportController from '../controllers/flutterExport.controller.js';

const router = Router();

router.post('/exportarSpringBoot/:id', CrearPaginaController.exportarSpringBootDesdeSala);

router.post('/exportarSpringBoot', CrearPaginaController.exportarSpringBootConRelaciones);

router.post('/exportarFlutter/:id', FlutterExportController.exportarDesdeSala);
router.post('/exportarFlutter', FlutterExportController.exportarConPayload);

router.post('/:id', CrearPaginaController.exportar);

export default router;
