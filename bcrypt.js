const bcrypt = require('bcrypt')
const plainPassword = '123456';

const encryptedPassword = bcrypt.hashSync(plainPassword, 12);
console.log(encryptedPassword) // $2b$10$GCQyK4d8vHkuWld0Zt59nOlSJbFj3QLj7bZtaqxj0iJFdcAywRg6y
console.log(
    bcrypt.compareSync("123456", encryptedPassword)
)
