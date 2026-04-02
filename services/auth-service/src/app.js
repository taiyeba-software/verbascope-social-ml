//import dependencies
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';

//initialize express app
const app = express();

//use middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

//export app
export default app;