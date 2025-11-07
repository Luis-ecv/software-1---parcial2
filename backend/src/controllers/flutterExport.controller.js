import * as ExportController from './export.controller.js';

const FlutterExportController = {
  // Reuse existing image export function for exporting a diagram from a board by id
  exportarDesdeSala: ExportController.exportBoardImage,

  // Placeholder: payload-based Flutter export is not yet implemented
  exportarConPayload: async (req, res) => {
    return res.status(501).json({
      success: false,
      message: 'exportarConPayload not implemented on flutterExport.controller'
    });
  }
};

export default FlutterExportController;
