class Socket {

  constructor(socket) {
    this.socket = socket;
    this.clients = {};
    this.players = {};
    this.unmatched = [];
    this.init();
  }

  init() {
    try {
//CONNECTED
      this.socket.on('connection', (socket) => {
        //WHEN A CLIENT CONNECTS, CONSOLE DISPLAY SOCKET NAME AND ID
        const { id } = socket;
        const { name } = socket.handshake.query;
        console.log(`New client connected. Client Name: ${name}   Socket ID: ${id}`);
        // STORE THE CURRENT CLIENT'S SOCKET TO 'clients'
        //clients = { socketId : socket }
        this.clients[id] = socket;
        //CALLING FUNCTION: INSERT OR UPDATE THE CURRENT CLIENT'S ELEMENTS TO 'players' AND 'unmatched'
        this.joinGame(socket, name);
        //CALLING FUNCTION: RETURN OPPONENT SOCKET ID OR RETURN NULL MEANS NO OPPONENT
        const opponent = this.opponentOf(socket);

//FOUND OPPONENT, START GAME
        //IF HAS, BEGIN THE GAME BY:
        if (opponent) {
          //SENT TO CURRENT CLIENT, CLIENT'S SOCKET'S EVENT NAME 'game.begin'
          //AND PASS SYMBOL AND OPPONENT'S NAME
          socket.emit('game.begin', {
            symbol: this.players[id].symbol,
            opponentName: this.players[opponent.id].name,
          });
          //SEND TO OPPONENT, OPPONENT'S SOCKET'S EVENT NAME 'game.begin'
          //AND PASS SYMBOL AND OPPONENT'S NAME TO OPPONENT
          opponent.emit('game.begin', {
            symbol: this.players[opponent.id].symbol,
            opponentName: this.players[id].name,
          });
        }
//WHEN PLAYER MAKE ACTION
        socket.on('make.move', (data) => {
          //CALLING FUNCTION: RETURN OPPONENT SOCKET ID OR RETURN NULL MEANS NO OPPONENT:
          const opponent = this.opponentOf(socket);
          //IF NO OPPONENT, RETURN NO ACTION
          if (!opponent) return;
          //IF HAS OPPONENT, SEND TO THE CURRENT CLIENT, OPPONENT EVENT NAME 'move.made'
          //AND PASS OPPONENT'S SOCKET NAME TO CURRENT CLIENT WITH MERGING OPPONENT'S data
          socket.emit('move.made', { ...data, opponentName: this.players[opponent.id].name });
          //SEND TO THE OPPONENT, THE CURRENT CLIENT EVENT NAME 'move.made'
          //AND PASS THE data TO OPPONENT
          opponent.emit('move.made', data);
        });

//DISCONNECTED
        socket.on('disconnect', () => {
          ////WHEN THE CURRENT CLIENT'S SOCKET DISCONNECTED, CONSOLE DISPLAY SOCKET ID
          console.log(`Client disconnected. Socket ID: ${id}`);
          //DELETE FROM 'clients'
          delete this.clients[id];
          //SEND TO ALL CLIENTS, THE CURRENT CLIENT'S EVENT NAME 'client.disconnect'
          //AND PASS SOCKET ID TO ALL CLIENTS
          socket.broadcast.emit("client.disconnect", id);
          //CALLING FUNCTION: RETURN OPPONENT SOCKET ID OR RETURN NULL MEANS NO OPPONENT
          const opponent = this.opponentOf(socket);
          //IF HAS, SEND TO THE OPPONENT, THE CURRENT CLIENT'S EVENT NAME 'opponent.left'
          //AND PASS THE CURRENT CLIENT'S NAME TO OPPONENT
          if (opponent) {
            opponent.emit('opponent.left', {
              opponentName: this.players[id].name,
            });
          }
          //DELETE FROM 'players' and 'unmatched'
          delete this.players[id];
          this.unmatched = this.unmatched.filter((element) => element !== id);
        });

      });
    } catch (error) {
      throw new Error(`SocketInit Error: ${error.message}`);
    }
  }

  joinGame(socket, name) {
    try {
      //STORE THE CURRENT CLIENT'S SOCKET NAME, OPPONENTID, SYMBOL, SOCKET TO 'players'
      //players = { socketId : {name,{opponent:null},{symbol:X},socket} }
      const { id } = socket;
      this.players[id] = {
        name,
        opponent: null,
        symbol: "X",
        socket,
      };
      //CHECK 'unmatched' ARRAY TO SEE WHETHER HAS SOCKET ID IS WAITING OPPONENT:
      if (this.unmatched.length > 0) {
        //IF HAS, UPDATE THE CURRENT CLIENT'S OPPONENTID, SYMBOL AND OPPONENT'S OPPONENTID
        //unmatched = [socketId1, socketId2]
        const unmatchedPlayerSocketId = this.unmatched.shift();
        this.players[id].symbol = 'O';
        this.players[id].opponent = unmatchedPlayerSocketId;
        this.players[unmatchedPlayerSocketId].opponent = id;
      } else {
        //IF HAS NOT, INSERT THE CURRENT CLIENT'S SOCKET ID TO UNMATCHED
        //unmatched = [ socketId ]
        this.unmatched.push(id);
      }
    } catch (error) {
      throw new Error(`JoinGame Error: ${error.message}`);
    }
  }

  opponentOf({ id }) {
    try {
      //CHECK WHETHER THE CURRENT CLIENT HAS AN OPPONENT OR NOT:
      const { opponent } = this.players[id];
      //IF HAS NOT, RETURN NULL
      if (!opponent) return null;
      //IF HAS, FIND AND RETURN THE OPPONENT SOCKET ID
      const player = this.players[opponent];
      return player && player.socket ? player.socket : null;
    } catch (error) {
      throw new Error(`OpponentOf Error: ${error.message}`);
    }
  }
}

module.exports = Socket;
