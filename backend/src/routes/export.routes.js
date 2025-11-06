// backend/src/routes/export.routes.js
import express from 'express';
import { exportBoardImage } from '../controllers/export.controller.js';

const router = express.Router();

// POST /apis/export/board/:id
// Consider protecting this route with authentication middleware (session/jwt)
router.post('/board/:id', exportBoardImage);

export default router;