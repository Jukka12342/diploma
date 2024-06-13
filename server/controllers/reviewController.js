import ApiError from "../error/ApiError.js";
import db from "../db.js";

class reviewController {
    async createReview(req, res, next) {
        try {
            const { rate, good_id, comment, seller_id } = req.body;
            const user_id = req.user.id;

            if (!rate || !good_id || !user_id || !seller_id) {
                return next(ApiError.badRequest("Некорректные данные."));
            }

            const existingReviewQuery = `
                SELECT id FROM rating WHERE user_id = $1 AND good_id = $2 AND seller_id = $3`;
            const existingReviewValues = [user_id, good_id, seller_id];
            const existingReviewResult = await db.query(
                existingReviewQuery,
                existingReviewValues
            );

            if (existingReviewResult.rows.length > 0) {
                const updateReviewQuery = `
                    UPDATE rating 
                    SET rate = $1, comment = $2
                    WHERE user_id = $3 AND good_id = $4 AND seller_id = $5
                    RETURNING id, rate, user_id, good_id, comment, seller_id, created_at`;
                const updateReviewValues = [
                    rate,
                    comment,
                    user_id,
                    good_id,
                    seller_id,
                ];
                const updateReviewResult = await db.query(
                    updateReviewQuery,
                    updateReviewValues
                );
                const updatedReview = updateReviewResult.rows[0];

                return res.json(updatedReview);
            }

            const newReviewQuery = `
                INSERT INTO rating (rate, user_id, good_id, comment, seller_id)
                VALUES ($1, $2, $3, $4, $5) RETURNING id, rate, user_id, good_id, comment, seller_id, created_at`;
            const newReviewValues = [
                rate,
                user_id,
                good_id,
                comment,
                seller_id,
            ];
            const newReviewResult = await db.query(
                newReviewQuery,
                newReviewValues
            );
            const newReview = newReviewResult.rows[0];

            return res.json(newReview);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при создании отзыва. Попробуйте снова."
                )
            );
        }
    }

    async hasReview(req, res, next) {
        try {
            const { user_id, good_id } = req.query;

            const query = `
                SELECT EXISTS(SELECT 1 FROM rating WHERE user_id = $1 AND good_id = $2) as exists`;
            const values = [user_id, good_id];
            const result = await db.query(query, values);

            return res.json({ exists: result.rows[0].exists });
        } catch (error) {
            return next(ApiError.internal("Ошибка при проверке отзыва."));
        }
    }

    async getReviewsBySeller(req, res, next) {
        try {
            const { seller_id } = req.params;

            if (!seller_id) {
                return next(ApiError.badRequest("Некорректные данные."));
            }

            const reviewsQuery = `
                SELECT r.id, r.rate, r.user_id, r.good_id, r.comment, r.created_at, 
                       g.name as good_name, g.price as good_price,
                       u.login
                FROM rating r
                JOIN "user" u ON r.user_id = u.id
                JOIN good g ON r.good_id = g.id
                WHERE g.user_id = $1
                ORDER BY r.created_at DESC`;

            const reviewsValues = [seller_id];
            const reviewsResult = await db.query(reviewsQuery, reviewsValues);
            const reviews = reviewsResult.rows;

            return res.json(reviews);
        } catch (error) {
            return next(
                ApiError.internal(
                    "Ошибка при получении отзывов. Попробуйте снова."
                )
            );
        }
    }
}

export default new reviewController();
