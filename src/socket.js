import { io } from "socket.io-client";

const socket = io("http://localhost:5000"); // Replace with actual server IP if hosted

export default socket;
