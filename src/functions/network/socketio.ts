//import express from 'express'
//import http from 'http'
//import cors from 'cors'
//import io from "socket.io"
//import { createServer } from "http";
//import { Server } from "socket.io";
import type { Server } from "socket.io";
import { SocketIoCtx } from '../../types/functions/socketio';

const PORT = 5000;

export default (createServer, Serv: typeof Server): SocketIoCtx => {
    //var app = express();
    //var https = http.createServer(app);

    /*
    var socketIo = io(https, {
        cors: {
            origin: '*',
        }
    });
    */

    /************************************************************************************************************
     * 
     * Middleware
     * 
    var corsOptions = {
        origin: '*',
        optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
    }
    app.use(cors(corsOptions));

    app.use('/', express.json());
     */



    const httpServer = createServer();
    const io = new Serv(httpServer, {
        cors: {
            origin: "https://example.com",
            methods: ["GET", "POST"]
        }
    });

    /************************************************************************************************************
     * Socket
     */
    io.on("connection", (socket) => {
        console.log('new client connected');

        socket.on('enter', () => {
            io.emit('send', { test: "test" });
        });
    });


    /************************************************************************************************************
     * Listener
     */
    httpServer.listen(PORT, () => {
        console.log(`listening on *:${PORT}`);
    });
    //httpServer.listen(3000);

    return {
        io
    }
}