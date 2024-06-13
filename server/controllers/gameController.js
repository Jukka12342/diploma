import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import path from "path";
import db from "../db.js";
import ApiError from "../error/ApiError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class gameController {
    async create(req, res, next) {
        try {
            let { name } = req.body;
            if (!req.files || !req.files.img) {
                throw new Error("Файл не был загружен.");
            }
            const { img } = req.files;
            let fileName = uuidv4() + ".jpg";
            img.mv(path.resolve(__dirname, "..", "static", fileName));

            const query = `
                INSERT INTO game (name, img)
                values ($1, $2) RETURNING *`;
            const values = [name, fileName];
            const newGameResult = await db.query(query, values);
            const newGame = newGameResult.rows[0];

            return res.json(newGame);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async getAll(req, res, next) {
        try {
            let games;
            const query = `SELECT * FROM game`;
            games = await db.query(query);
            return res.json(games.rows);
        } catch (e) {
            return next(ApiError.internal("Ошибка при загрузке игр."));
        }
    }

    async getCount(req, res, next) {
        try {
            let count;
            const query = `SELECT count(*) FROM game;`;
            count = await db.query(query);
            return res.json(count.rows[0]);
        } catch (e) {
            return next(ApiError.internal("Ошибка при загрузке игр."));
        }
    }

    async search(req, res, next) {
        try {
            const { query } = req.query;
            const searchQuery = `
                SELECT * FROM game
                WHERE name ILIKE $1`;
            const values = [`%${query}%`];
            const result = await db.query(searchQuery, values);
            return res.json(result.rows);
        } catch (e) {
            return next(ApiError.internal("Ошибка при поиске игр."));
        }
    }
}

export default new gameController();
