// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Socket {

  constructor(socket) {
    this.socket = socket;
    this.clients = []; //TO CONTROL ONE ACCOUNT ONE SOCKET
    this.players = {}; //TO STORE PLAYERS' INFO
    this.unmatched = []; //TO STORE WAITING PLAYERS' SOCKET ID
    this.init();
  }

  init() {
    try {
//CONNECTED (WHEN CLIENT CONNECTS, AUTO RECEIVE FROM CLIENT'S SOCKET, EVENT NAME 'connect')
      this.socket.on('connect', (socket) => {
        //CONSOLE DISPLAY SOCKET NAME AND ID
        const { id } = socket;
        const { clientId, name } = socket.handshake.query;
        //IF clients HAS NOT THE CLIENT ID, MEANS THE CLIENT'S ACCOUNT JUST CONNECT TO A SOCKET ONLY
        if (!this.clients.includes(clientId)) {
          console.log(`New client connected. Client ID:${clientId}   Client Name: ${name}   Socket ID: ${id}`);
          // STORE THE CURRENT CLIENT'S ID TO 'clients'
          this.clients.push(clientId);
          //CALLING FUNCTION: INSERT OR UPDATE THE CURRENT CLIENT'S INFO TO 'players' AND 'unmatched'
          this.joinGame(socket, clientId, name);
          //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
          const opponent = this.opponentOf(socket);

//FOUND OPPONENT, START GAME
          //IF HAS, BEGIN THE GAME BY:
          if (opponent) {
            //SENT TO CURRENT CLIENT, CLIENT'S SOCKET'S EVENT NAME 'game.begin'
            //AND PASS CURRENT CLIENT'S SYMBOL AND OPPONENT'S NAME TO CURRENT CLIENT
            socket.emit('game.begin', {
              symbol: this.players[id].symbol,
              opponentName: this.players[opponent.id].name,
            });
            //SEND TO OPPONENT, OPPONENT'S SOCKET'S EVENT NAME 'game.begin'
            //AND PASS OPPONENT'S SYMBOL AND CURRENT CLIENT'S NAME TO OPPONENT
            opponent.emit('game.begin', {
              symbol: this.players[opponent.id].symbol,
              opponentName: this.players[id].name,
            });
          }

//REQUEST RECHALLENGE (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'request.rechallenge')
          //CHECK WHETHER THE CURRENT CLIENT HAS AN OPPONENT OR NOT
          //IF HAS, SEND TO OPPONENT, OPPONENT'S SOCKET'S EVENT NAME 'rechallenge.request'
          //AND PASS REQUEST MSG TO OPPONENT
          socket.on('request.rechallenge', (reqMessage) => {
            const sameOpponent = this.opponentOf(socket);
            if (!sameOpponent) return;
            sameOpponent.emit('rechallenge.request', reqMessage);
          });

//CONFIRM RECHALLENGE WITH SAME OPPONENT, RESTART GAME (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'restart.game')
          socket.on('restart.game', (reqMessage) => {
            const sameOpponent = this.opponentOf(socket);
            if (sameOpponent) {
              //SENT TO CURRENT CLIENT, CLIENT'S SOCKET'S EVENT NAME 'game.begin'
              //AND PASS CURRENT CLIENT'S SYMBOL AND OPPONENT'S NAME TO CURRENT CLIENT
              socket.emit('game.begin', {
                symbol: this.players[id].symbol,
                opponentName: this.players[sameOpponent.id].name,
              });
              //SEND TO OPPONENT, OPPONENT'S SOCKET'S EVENT NAME 'game.begin'
              //AND PASS OPPONENT'S SYMBOL AND CURRENT CLIENT'S NAME TO OPPONENT
              sameOpponent.emit('game.begin', {
                symbol: this.players[sameOpponent.id].symbol,
                opponentName: this.players[id].name,
              });
            }
          });

//WHEN PLAYER MAKE ACTION (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'make.move')
          socket.on('make.move', (data) => {
            //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT:
            const opponent = this.opponentOf(socket);
            //IF NO OPPONENT, RETURN NO ACTION
            if (!opponent) return;
            //IF HAS OPPONENT, SEND TO THE CURRENT CLIENT, OPPONENT EVENT NAME 'move.made'
            //AND PASS OPPONENT'S SOCKET NAME TO CURRENT CLIENT WITH MERGING OPPONENT'S data
            //data IS FROM FRONT END SIDE, CONTAINS CELL SYMBOL AND CELL ATTRIBUTE ID
            socket.emit('move.made', { ...data, opponentName: this.players[opponent.id].name });
            //SEND TO THE OPPONENT, THE CURRENT CLIENT EVENT NAME 'move.made'
            //AND PASS THE data TO OPPONENT
            opponent.emit('move.made', data);
          });

//WHEN GAME OVER  (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'game.over')
            //GET GAME RESULT AND RUN QUERY TO UPDATE USER SCORE
            //CALCULATION: total_played PLUS ONE AND IF THE PLAYER WIN, total_win PLUS ONE
            //IF UPDATE SUCCESSFULLY, SEND TO THE CURRENT CLIENT'S SOCKET, THE CURRENT CLIENT EVENT NAME 'score.inserted'
            //AND PASS THE SCORE DATA TO CURRENT CLIENT'S SOCKET
            socket.on('game.over', async (gameResult) => {
              const [userResult] =  await mysql.execute(query.searchUserScore, [this.players[id].clientId]);
              if (userResult.length == 1) {
                let {total_played, total_win, percentage} = userResult[0];
                if (gameResult.length > 0) {
                  total_played++;
                  if (gameResult == 'WIN')
                    total_win++;
                  percentage = Math.round(total_win/total_played * 100);
                  const opponent = this.opponentOf(socket);
                  let opponentName = '';
                  if (opponent)
                    opponentName = this.players[opponent.id].name;
                  const doneInsertScore = await mysql.execute(query.insertScore,
                    [this.players[id].clientId,
                    this.players[opponent.id].clientId,
                    gameResult]);
                  const doneInsertUserScore = await mysql.execute(query.insertUserScore,
                    [total_played,
                    total_win,
                    percentage,
                    this.players[id].clientId]);
                  if (doneInsertScore && doneInsertUserScore)
                    socket.emit('score.inserted', {opponentName, gameResult, total_played, total_win, percentage});
                }
                else
                  socket.emit('score.noupdate', {total_played, total_win, percentage});
              }
           });

//DISCONNECTED (WHEN CLIENT DISCONNECT, AUTO RECEIVE FROM CLIENT'S SOCKET, EVENT NAME 'disconnect')
          socket.on('disconnect', () => {
            ////WHEN THE CURRENT CLIENT'S SOCKET DISCONNECTED, CONSOLE DISPLAY SOCKET ID
            console.log(`Client disconnected. Client ID:${clientId}   Client Name: ${name}  Socket ID: ${id}`);
            //SEND TO ALL CLIENTS, THE CURRENT CLIENT'S EVENT NAME 'client.disconnect'
            //AND PASS SOCKET ID TO ALL CLIENTS
            socket.broadcast.emit('client.disconnect', id);
            //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
            const opponent = this.opponentOf(socket);
            //IF HAS, SEND TO THE OPPONENT, THE CURRENT CLIENT'S EVENT NAME 'opponent.left'
            //AND PASS THE CURRENT CLIENT'S NAME TO OPPONENT
            if (opponent) {
              opponent.emit('opponent.left', {
                opponentName: this.players[id].name,
              });
            }
            //DELETE FROM 'clients', 'players' and 'unmatched'
            delete this.players[id];
            this.unmatched = this.unmatched.filter((element) => element !== id);
            this.clients = this.clients.filter((element) => element !== clientId);
          });

        }
        //IF clients HAS THE CLIENT ID, MEANS THE CLIENT'S ACCOUNT HAD CONNECTED TO A SOCKET, CANNOT CREATE ONE MORE SOCKET
        else {
          console.log(`${name}'s socket authenticated.`);
          socket = null;
          return;
        }
      });
    }
    catch (error) {
      throw new Error(`SocketInit Error: ${error.message}`);
    }
  }

  joinGame(socket, clientId, name) {
    try {
      //STORE THE CURRENT CLIENT'S ID, SOCKET NAME, OPPONENTID, SYMBOL, SOCKET TO 'players'
      //players = { socketId : {clientId,name,{opponent:null},{symbol:X},socket} }
      const { id } = socket;
      this.players[id] = {
        clientId,
        name,
        opponent: null,
        symbol: 'X',
        socket,
      };
      //CHECK 'unmatched' ARRAY TO SEE WHETHER HAS SOCKET ID IS WAITING OPPONENT:
      if (this.unmatched.length > 0) {
        //IF HAS, UPDATE THE CURRENT CLIENT'S OPPONENTID, SYMBOL='O' AND OPPONENT'S OPPONENTID
        //unmatched = [socketId1, socketId2]
        const unmatchedPlayerSocketId = this.unmatched.shift();
        this.players[id].symbol = 'O';
        this.players[id].opponent = unmatchedPlayerSocketId;
        this.players[unmatchedPlayerSocketId].opponent = id;
      }
      else {
        //IF HAS NOT, INSERT THE CURRENT CLIENT'S SOCKET ID TO UNMATCHED
        //unmatched = [ socketId ]
        this.unmatched.push(id);
      }
    }
    catch (error) {
      throw new Error(`JoinGame Error: ${error.message}`);
    }
  }

  opponentOf({ id }) {
    try {
      //CHECK WHETHER THE CURRENT CLIENT HAS AN OPPONENT OR NOT:
      const { opponent } = this.players[id];
      //IF HAS NOT, RETURN NULL
      if (!opponent) return null;
      //IF HAS, FIND AND RETURN THE OPPONENT SOCKET
      const player = this.players[opponent];
      return player && player.socket ? player.socket : null;
    }
    catch (error) {
      throw new Error(`OpponentOf Error: ${error.message}`);
    }
  }
}

module.exports = Socket;
