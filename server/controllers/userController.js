import ApiError from "../error/ApiError.js";
import bcrypt from "bcrypt";
import db from "../db.js";
import path from "path";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname } from "path";

const PROFILE_PICTURE = "profile_picture.png";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateJwt = (id, email, login, role) => {
    return jwt.sign({ id, login, email, role }, process.env.SECRET_KEY, {
        expiresIn: "24h",
    });
};

class UserController {
    async registration(req, res, next) {
        try {
            const { login, email, password } = req.body;

            if (!email || !password || !login) {
                return next(ApiError.badRequest("Некорректные данные."));
            }

            const existingUser = await findUser(email, login);
            if (existingUser) {
                return next(
                    ApiError.badRequest(
                        "Пользователь с данной почтой или логином уже зарегистрирован."
                    )
                );
            }

            const hashPassword = await bcrypt.hash(password, 5);

            const newUserQuery = `
                INSERT INTO "user" (login, email, password, role, rate, avatar)
                values ($1, $2, $3, $4, $5, $6) RETURNING id, login, email, role`;
            const newUserValues = [
                login,
                email,
                hashPassword,
                1,
                0.0,
                PROFILE_PICTURE,
            ];
            const newUserResult = await db.query(newUserQuery, newUserValues);
            const newUser = newUserResult.rows[0];

            const token = generateJwt(
                newUser.id,
                newUser.email,
                newUser.login,
                newUser.role
            );
            return res.json({ token });
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при регистрации пользователя. Попробуйте использовать другие данные для регистрации, это может помочь."
                )
            );
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return next(ApiError.badRequest("Некорректные данные."));
            }

            const user = await checkUserData(email);

            if (!user) {
                return next(
                    ApiError.badRequest(
                        "Пользователь с указанным email не найден."
                    )
                );
            }

            const comparePassword = await bcrypt.compare(
                password,
                user.password
            );

            if (!comparePassword) {
                return next(ApiError.badRequest("Вы ввели неверный пароль."));
            }

            const token = generateJwt(
                user.id,
                user.email,
                user.login,
                user.role
            );
            return res.json({ token });
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при входе пользователя. Попробуйте снова."
                )
            );
        }
    }

    async check(req, res, next) {
        try {
            const { id, email, login, role } = req.user;

            if (!id || !email || !login || !role) {
                return next(ApiError.internal("Неполные данные пользователя."));
            }

            const token = generateJwt(id, email, login, role);
            return res.json({ token });
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при проверке пользователя. Попробуйте снова."
                )
            );
        }
    }

    async getOneUser(req, res, next) {
        try {
            const id = req.params.id;
            const query = `SELECT * FROM "user" WHERE id = $1`;
            const user = await db.query(query, [id]);
            res.json(user.rows[0]);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при получении информации о пользователе. Попробуйте снова." +
                        error
                )
            );
        }
    }

    async addBalance(req, res, next) {
        try {
            const { userId, amount } = req.body;

            if (!userId || !amount) {
                return next(ApiError.badRequest("Некорректные данные."));
            }

            if (amount <= 0) {
                return next(
                    ApiError.badRequest(
                        "Сумма пополнения должна быть больше нуля."
                    )
                );
            }

            const query = `UPDATE "user" SET balance = balance + $1 WHERE id = $2 RETURNING id, login, email, role, balance`;
            const values = [amount, userId];
            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return next(ApiError.badRequest("Пользователь не найден."));
            }

            const updatedUser = result.rows[0];

            const token = generateJwt(
                updatedUser.id,
                updatedUser.email,
                updatedUser.login,
                updatedUser.role
            );

            return res.json({ token, balance: updatedUser.balance });
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при пополнении баланса. Попробуйте снова."
                )
            );
        }
    }

    async updateUser(req, res, next) {
        try {
            const { id, email, avatar } = req.body;
            const query = `UPDATE "user" SET email = $1, avatar = $2 WHERE id = $3 RETURNING *`;
            const values = [email, avatar, id];
            const user = await db.query(query, values);
            res.json(user.rows[0]);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при обновлении информации о пользователе. Попробуйте снова."
                )
            );
        }
    }

    async update(req, res, next) {
        try {
            const { id } = req.params;
            let { description } = req.body;
            let fileName;

            if (req.files && req.files.avatar) {
                const { avatar } = req.files;
                fileName = uuidv4() + ".jpg";
                avatar.mv(path.resolve(__dirname, "..", "static", fileName));
            }

            let query = `UPDATE "user" SET `;
            const values = [];
            let index = 1;

            if (description) {
                query += `description = $${index}, `;
                values.push(description);
                index++;
            }

            if (fileName) {
                query += `avatar = $${index}, `;
                values.push(fileName);
                index++;
            }

            query = query.slice(0, -2);

            query += ` WHERE id = $${index} RETURNING *`;
            values.push(id);

            const updatedUserResult = await db.query(query, values);
            const updatedUser = updatedUserResult.rows[0];

            return res.json(updatedUser);
        } catch (e) {
            next(ApiError.badRequest(e.message));
        }
    }

    async getUserPurchases(req, res, next) {
        try {
            const userId = req.user.id;
            const query = `
                SELECT p.id, p.customer, p.seller, p.good_id, g.name, g.price, p.created_at 
                FROM purchases p
                JOIN good g ON p.good_id = g.id
                WHERE p.customer = $1
                ORDER BY p.created_at DESC
            `;
            const values = [userId];
            const purchases = await db.query(query, values);
            return res.json(purchases.rows);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при получении списка покупок пользователя. Попробуйте снова."
                )
            );
        }
    }

    async getUserSells(req, res, next) {
        try {
            const userId = req.user.id;
            const query = `
                SELECT p.id, p.customer, p.seller, p.good_id, g.name, g.price, p.created_at 
                FROM purchases p
                JOIN good g ON p.good_id = g.id
                WHERE p.seller = $1
                ORDER BY p.created_at DESC
            `;
            const values = [userId];
            const purchases = await db.query(query, values);
            return res.json(purchases.rows);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при получении списка продаж пользователя. Попробуйте снова."
                )
            );
        }
    }

    async blockUser(req, res, next) {
        try {
            const userId = req.params.id;
            const queryUpdateUser = `UPDATE "user" SET role = 4 WHERE id = $1 RETURNING *`;
            const values = [userId];
            await db.query(queryUpdateUser, values);

            const queryUpdateGoodsVisibility = `
                UPDATE good
                SET visibility = FALSE
                WHERE user_id = $1`;
            await db.query(queryUpdateGoodsVisibility, values);

            res.json({ message: "User blocked successfully." });
        } catch (error) {
            return next(
                ApiError.internal("Error blocking the user. Please try again.")
            );
        }
    }

    async unblockUser(req, res, next) {
        try {
            const userId = req.params.id;
            const query = `UPDATE "user" SET role = 1 WHERE id = $1 RETURNING *`;
            const values = [userId];
            const updatedUser = await db.query(query, values);
            res.json(updatedUser.rows[0]);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Error unblocking the user. Please try again."
                )
            );
        }
    }

    async isUserBlocked(req, res, next) {
        try {
            const userId = req.params.id;
            const query = `SELECT role FROM "user" WHERE id = $1`;
            const values = [userId];
            const result = await db.query(query, values);
            const userRole = result.rows[0]?.role;
            if (userRole === 4) {
                return res.json({ blocked: true });
            } else {
                return res.json({ blocked: false });
            }
        } catch (error) {
            return next(
                ApiError.internal(
                    "Error checking if the user is blocked. Please try again."
                )
            );
        }
    }

    async grantTechSupport(req, res, next) {
        try {
            const userId = req.params.id;
            const query = `UPDATE "user" SET role = 3 WHERE id = $1 RETURNING *`;
            const values = [userId];
            const updatedUser = await db.query(query, values);
            res.json(updatedUser.rows[0]);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Error granting tech support rights. Please try again."
                )
            );
        }
    }

    async revokeTechSupport(req, res, next) {
        try {
            const userId = req.params.id;
            const query = `UPDATE "user" SET role = 1 WHERE id = $1 RETURNING *`;
            const values = [userId];
            const updatedUser = await db.query(query, values);
            res.json(updatedUser.rows[0]);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Error revoking tech support rights. Please try again."
                )
            );
        }
    }
}

const findUser = async (email, login) => {
    try {
        const query = `SELECT * FROM "user" WHERE email = $1 OR login = $2`;
        const values = [email, login];
        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        throw new Error("Что-то пошло не так.");
    }
};

const checkUserData = async (email) => {
    try {
        const query = `SELECT * FROM "user" WHERE email = $1`;
        const values = [email];
        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        throw new Error("Что-то пошло не так.");
    }
};

export default new UserController();
