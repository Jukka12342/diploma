import db from "../db.js";
import ApiError from "../error/ApiError.js";

class goodController {
    async create(req, res, next) {
        try {
            const {
                name,
                price,
                gameId,
                userId,
                description,
                login,
                password,
                email,
                email_password,
            } = req.body;

            const query = `
                INSERT INTO good (name, price, game_id, user_id, description, login, password, email, email_password, visibility)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`;
            const values = [
                name,
                price,
                gameId,
                userId,
                description,
                login,
                password,
                email,
                email_password,
            ];

            const newGoodResult = await db.query(query, values);
            const newGood = newGoodResult.rows[0];

            return res.json(newGood);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async getAll(req, res, next) {
        try {
            const query = `SELECT
                g.id AS good_id,
                g.name AS good_name,
                g.price AS good_price,
                u.login AS user_login,
                u.rate AS user_rate,
                u.avatar AS user_avatar,
                g.visibility AS visibility
            FROM
                good g
            JOIN
                "user" u ON g.user_id = u.id
            WHERE
                g.visibility = true;`;
            const goods = await db.query(query);
            return res.json(goods.rows);
        } catch (e) {
            return next(ApiError.internal("Ошибка при загрузке товаров."));
        }
    }

    async getByGameId(req, res, next) {
        try {
            const { gameId } = req.params;
            const query = `SELECT
                g.id AS good_id,
                g.name AS good_name,
                g.price AS good_price,
                u.login AS user_login,
                u.rate AS user_rate,
                u.avatar AS user_avatar,
                g.game_id AS game_id,
                g.visibility AS visibility
            FROM
                good g
            JOIN
                "user" u ON g.user_id = u.id
            WHERE
                g.game_id = $1 AND g.visibility = true;`;
            const values = [gameId];
            const goods = await db.query(query, values);
            return res.json(goods.rows);
        } catch (e) {
            return next(ApiError.internal("Ошибка при загрузке товаров."));
        }
    }

    async getByUserId(req, res, next) {
        try {
            const { userId } = req.params;
            const query = `SELECT
                g.id AS good_id,
                g.name AS good_name,
                g.price AS good_price,
                g.visibility AS visibility
            FROM
                good g
            WHERE
                g.user_id = $1 AND g.visibility = true;`;
            const values = [userId];
            const goods = await db.query(query, values);
            return res.json(goods.rows);
        } catch (e) {
            return next(
                ApiError.internal("Ошибка при загрузке товаров пользователя.")
            );
        }
    }

    async getOffer(req, res, next) {
        try {
            const { goodId } = req.params;
            const query = `SELECT
                g.id AS good_id,
                g.name AS good_name,
                g.price AS good_price,
                g.created_at AS good_created_at,
                g.description AS good_description,
                g.visibility AS good_visibility,
                u.id AS user_id,
                u.login AS user_login,
                u.rate AS user_rate,
                u.avatar AS user_avatar,
                gm.id AS game_id,
                gm.img as game_img
            FROM
                good g
            JOIN
                "user" u ON g.user_id = u.id
            JOIN
                game gm ON g.game_id = gm.id
            WHERE
                g.id = $1;
            `;
            const values = [goodId];
            const offer = await db.query(query, values);
            if (offer.rows.length === 0) {
                return next(ApiError.badRequest("Товар не найден."));
            }
            return res.json(offer.rows[0]);
        } catch (e) {
            console.error(e);

            return next(ApiError.internal("Ошибка при загрузке товара."));
        }
    }

    async hideGood(req, res, next) {
        try {
            const { goodId } = req.params;
            const query = `
                UPDATE good
                SET visibility = false
                WHERE id = $1
                RETURNING *;
            `;
            const values = [goodId];
            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return next(ApiError.badRequest("Товар не найден."));
            }

            return res.json(result.rows[0]);
        } catch (e) {
            return next(ApiError.internal("Ошибка при скрытии товара."));
        }
    }

    async publishGood(req, res, next) {
        try {
            const { goodId } = req.params;
            const query = `
                UPDATE good
                SET visibility = true
                WHERE id = $1
                RETURNING *;
            `;
            const values = [goodId];
            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return next(ApiError.badRequest("Товар не найден."));
            }

            return res.json(result.rows[0]);
        } catch (e) {
            return next(ApiError.internal("Ошибка при публикации товара."));
        }
    }

    async purchaseGood(req, res, next) {
        try {
            const { goodId } = req.params;
            const userId = req.user.id;
            const client = await db.connect();

            try {
                await client.query("BEGIN");

                const goodQuery = "SELECT * FROM good WHERE id = $1 FOR UPDATE";
                const goodResult = await client.query(goodQuery, [goodId]);
                const good = goodResult.rows[0];

                if (!good) {
                    throw new Error("Товар не найден.");
                }

                if (!good.visibility) {
                    throw new Error("Товар недоступен для покупки.");
                }

                const userQuery = 'SELECT balance FROM "user" WHERE id = $1';
                const userResult = await client.query(userQuery, [userId]);
                const user = userResult.rows[0];

                if (user.balance < good.price) {
                    return next(
                        ApiError.badRequest("Недостаточно средств для покупки.")
                    );
                }

                const updateUserBalanceQuery =
                    'UPDATE "user" SET balance = balance - $1 WHERE id = $2';
                await client.query(updateUserBalanceQuery, [
                    good.price,
                    userId,
                ]);

                const updateSellerBalanceQuery =
                    'UPDATE "user" SET balance = balance + $1 WHERE id = $2';
                await client.query(updateSellerBalanceQuery, [
                    good.price,
                    good.user_id,
                ]);

                const hideGoodQuery =
                    "UPDATE good SET visibility = false WHERE id = $1";
                await client.query(hideGoodQuery, [goodId]);

                const insertPurchaseQuery =
                    "INSERT INTO purchases (customer, seller, good_id) VALUES ($1, $2, $3)";
                await client.query(insertPurchaseQuery, [
                    userId,
                    good.user_id,
                    goodId,
                ]);

                await client.query("COMMIT");

                res.json({
                    login: good.login,
                    password: good.password,
                    email: good.email,
                    email_password: good.email_password,
                });
            } catch (error) {
                await client.query("ROLLBACK");
                next(ApiError.internal(error.message));
            } finally {
                client.release();
            }
        } catch (error) {
            next(ApiError.internal("Ошибка при покупке товара."));
        }
    }

    async getGoodData(req, res, next) {
        try {
            const { goodId } = req.params;
            const query = `SELECT
                g.id AS good_id,
                g.name AS good_name,
                g.price AS good_price,
                g.description AS good_description,
                g.login AS good_login,
                g.password AS good_password,
                g.email AS good_email,
                g.email_password AS good_email_password,
                g.visibility AS good_visibility
            FROM
                good g
            WHERE
                g.id = $1;
            `;
            const values = [goodId];
            const goodData = await db.query(query, values);
            if (goodData.rows.length === 0) {
                return next(ApiError.badRequest("Товар не найден."));
            }
            return res.json(goodData.rows[0]);
        } catch (e) {
            return next(
                ApiError.internal("Ошибка при загрузке данных товара.")
            );
        }
    }
}

export default new goodController();
