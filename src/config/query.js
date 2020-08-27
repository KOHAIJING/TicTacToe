exports.table = `
CREATE TABLE users (
  id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
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
