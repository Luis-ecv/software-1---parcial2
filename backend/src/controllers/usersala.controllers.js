import { createUserSala, getUserSalaById, getUserSalas, deleteUserSala } from '../models/usersala.model.js';
import { getSalaById } from '../models/sala.model.js'
import { catchedAsync, response } from '../middlewares/catchedAsync.js';

class UserSalaController {
    constructor() {}

    register = catchedAsync(async (req, res) => {
        const { salas_id, userId } = req.body;
        try {
            const usersala = await createUserSala(userId, salas_id);
            response(res, 201, usersala);
        } catch (error) {
            next(error);
        }
    });

    getUserSalaById = catchedAsync(async (req, res) => {
        const { id } = req.params;
        const usersala = await getUserSalaById(id);
        response(res, 200, usersala);
    });

    getUserSalas = catchedAsync(async (req, res) => {
        const userId = req.user.id;
        const usersalas = await getUserSalas(userId);
        response(res, 200, usersalas);
    });

    delete = catchedAsync(async (req, res) => {
        const { id } = req.params;
        const usersala = await deleteUserSala(id);
        response(res, 200, usersala);
    });
}

export default new UserSalaController();
