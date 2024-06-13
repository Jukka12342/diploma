
CREATE TABLE user_role (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);


CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role INTEGER NOT NULL DEFAULT 0 REFERENCES user_role(id),
    rate FLOAT NOT NULL DEFAULT 0,
    description VARCHAR(MAX),
    avatar VARCHAR(255),
    balance NUMERIC(15, 2) DEFAULT 0
);

CREATE TABLE game (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    img VARCHAR(255) NOT NULL
);

CREATE TABLE good (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    game_id INTEGER NOT NULL REFERENCES game(id),
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    login VARCHAR(255),
    password VARCHAR(255),
    email VARCHAR(255),
    email_password VARCHAR(255),
    visibility BOOLEAN
);


CREATE TABLE rating (
    id SERIAL PRIMARY KEY,
    rate INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    good_id INTEGER NOT NULL REFERENCES "good"(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    customer INTEGER NOT NULL REFERENCES "user"(id),
    seller INTEGER NOT NULL REFERENCES "user"(id),
    good_id INTEGER NOT NULL REFERENCES "good"(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- триггер и функция для обновления рейтинга
CREATE OR REPLACE FUNCTION update_user_rate() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "user"
    SET rate = (SELECT AVG(rate) FROM rating WHERE user_id = NEW.user_id)
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_user_rate_trigger
AFTER INSERT OR UPDATE OR DELETE ON rating
FOR EACH ROW
EXECUTE FUNCTION update_user_rate();