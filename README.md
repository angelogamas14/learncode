# LearnIT Student Assessment

A simple student assessment system with instructor and student roles.

## Features

- **Instructor**
  - Login with ID and password
  - Create students (full name, username, password, block, year)
  - Create assessments / modules
  - Assign assessments to a specific block and year
- **Student**
  - Login with username and password
  - View assessments / modules assigned to their block and year

## Default Instructor Account

- ID: `INST-001`
- Password: `instructor123`

## Getting Started

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Tech Stack

- Node.js + Express
- JSON file store
- bcryptjs
- express-session
