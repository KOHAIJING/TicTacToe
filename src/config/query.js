exports.tableUser = `
CREATE TABLE users (
  id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  total_win INT(10) NOT NULL DEFAULT '0',
  total_played INT(10) NOT NULL DEFAULT '0',
  percentage INT(10) NOT NULL DEFAULT '0',
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
`;

exports.tableScore = `
CREATE TABLE scores(
 id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
 user_id INT(10) UNSIGNED NOT NULL,
 opponent_id INT(10) UNSIGNED NOT NULL,
 result VARCHAR(50) NOT NULL,
 created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
 PRIMARY KEY (id),
 CONSTRAINT FK_user_id FOREIGN KEY (user_id) REFERENCES users (id),
 CONSTRAINT FK_opponent_id FOREIGN KEY (opponent_id) REFERENCES users (id)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
`;

exports.searchUser = `
SELECT * FROM users
WHERE email = ?;
`;

exports.insertUser = `
INSERT INTO users(name, email, password)
VALUES(?, ?, ?);
`;

exports.searchScore = `
SELECT * FROM scores
WHERE user_id = ?;
`;

exports.insertScore = `
INSERT INTO scores(user_id, opponent_id, result)
VALUES(?, ?, ?);
`;

exports.searchUserScore = `
SELECT name, total_win, total_played, percentage FROM users
WHERE id = ?;
`;

exports.insertUserScore = `
UPDATE users
SET total_played = ?, total_win = ?, percentage = ? WHERE id = ?;
`;

exports.searchAllUserScore = `
SELECT name, total_win, total_played, percentage FROM users
WHERE total_played != 0
ORDER BY percentage DESC;
`;
