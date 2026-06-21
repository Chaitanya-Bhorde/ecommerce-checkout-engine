Day 1 — Project Setup & GitHub Initialization

What I Built


Initialized a Node.js project using npm init
Installed core backend dependencies: express, mongoose, dotenv, cors, cookie-parser, bcryptjs, jsonwebtoken
Installed nodemon as a dev dependency for automatic server restarts during development
Created a modular folder structure inside src/:

config/ — for database and other configuration files
controllers/ — for request-handling logic
middleware/ — for authentication, validation, and other middleware functions
models/ — for Mongoose schemas
routes/ — for API route definitions
utils/ — for helper/utility functions



Set up a basic Express server (server.js) and confirmed it runs successfully on port 5000
Created a .gitignore file to exclude node_modules, .env, dist/, .DS_Store, and log files from version control
Initialized a Git repository, made the first commit, and pushed the project to GitHub

Why I Structured It This Way


A modular folder structure (separating controllers, routes, models, middleware) keeps the codebase organized and scalable as more features are added in later stages
Using .gitignore prevents sensitive data (like .env secrets) and unnecessary large folders (node_modules) from being pushed to GitHub
nodemon improves development speed by automatically restarting the server on file changes, instead of restarting manually every time


What I Learned Today


The purpose of a .gitignore file and why certain files/folders should never be committed to version control
How to initialize a Git repository, stage changes, commit, and push to a remote GitHub repository
The difference between dependencies and devDependencies in package.json (nodemon is a dev dependency since it's only needed during development, not in production)


Challenges Faced (and How I Solved Them)


PowerShell does not support the && operator for chaining commands like in bash/Linux terminals; used ; instead to run multiple commands in sequence
Had to ensure node_modules and .env were properly excluded before the first commit — verified this using git status before committing