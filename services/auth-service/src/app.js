//import dependencies
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

//initialize express app
const app = express();

//use middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

//export app
export default app;