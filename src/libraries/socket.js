// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Socket {

  constructor(socket) {
    this.socket = socket;
    this.clients = []; //TO CONTROL ONE ACCOUNT ONE SOCKET
    this.players = {}; //TO STORE PLAYERS' INFO
    this.unmatched = []; //TO STORE WAITING PLAYERS' SOCKET ID
    this.emailandSocketId = {}; //TO STORE PLAYERS' ID AND SOCKET ID FOR INVITATION
    this.init();
  }

  init() {
    try {
//CONNECTED (WHEN CLIENT CONNECTS, AUTO RECEIVE FROM CLIENT'S SOCKET, EVENT NAME 'connect')
      this.socket.on('connect', async (socket) => {
        //CONSOLE DISPLAY SOCKET NAME AND ID
        const { id } = socket;
        const { clientId, name } = socket.handshake.query;
        //USE QUERY TO GET THE USER EMAIL
        let email = '';
        const [userResult] = await mysql.execute(query.searchUserById, [clientId]);
        if (userResult.length == 1) {
          email = userResult[0].email;
        }
        //IF clients HAS NOT THE CLIENT ID, MEANS THE CLIENT'S ACCOUNT JUST CONNECT TO A SOCKET ONLY
        if (!this.clients.includes(clientId)) {
          console.log(`New client connected. Client ID:${clientId}   Client Name: ${name}   Socket ID: ${id}`);
          // STORE THE CURRENT CLIENT'S ID TO 'clients'
          this.clients.push(clientId);
          //STORE THE CURRENT CLIENT'S EMAIL AND SOCKET ID TO 'emailandSocketId'
          this.emailandSocketId[email] = id;
          //STORE THE CURRENT CLIENT'S ID, SOCKET NAME, OPPONENTID, SYMBOL, SOCKET TO 'players'
          //players = { socketId : {clientId,name,{opponent:null},{symbol:X},socket} }
          this.players[id] = {
            clientId,
            name,
            email,
            opponent: null,
            symbol: 'X',
            socket,
          };

//IF USER CHOOSE INVITE OPPONENT, RECEIVE FROM CLIENT'S SOCKET, EVENT NAME 'invite.opponent' AND RECEIVED INPUT EMAIL
          socket.on('invite.opponent', (inputEmail) => {
            //CALLING FUNCTION: USE INPUT EMAIL TO FIND INVITEE, SEND TO INVITEE'S SOCKET, EVENT NAME 'request.invitation' TO REQUEST ACCEPT
			//AND SEND TO CLIENT'S SOCKET, EVENT NAME 'waiting.accept' TO SHOW WAITING MESSAGE
            this.joinGameForInviteOpponent(socket, email, inputEmail);
            //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
            const opponent = this.opponentOf(socket);
            //IF FOUND OPPONENT THEN START GAME
            this.startGame(socket, opponent);
            this.gameSession(socket);
          });

//ACCEPT INVITATION, UPDATE THE INVITEE'S OPPONENTID, SYMBOL='O' AND INVITEE'S OPPONENTID
//AT HERE, THE 'id' AND 'socket' REPRESENTED INVITEE'S SOCKET ID AND SOCKET
//'invitationOwnerId' AND 'invitationOwnerSocket'  REPRESENTED INVITATION OWNER'S SOCKET ID AND SOCKET
          socket.on('accept.invitation', (invitationOwnerId) => {
            this.players[id].symbol = 'O';
            this.players[id].opponent = invitationOwnerId;
            this.players[invitationOwnerId].opponent = id;
            //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
            const invitationOwnerSocket = this.opponentOf(socket);
            //IF FOUND OPPONENT THEN START GAME
            this.startGame(socket, invitationOwnerSocket);
            this.gameSession(socket);
          });

//REJECT INVITATION, SEND TO THE INVITATION OWNER'S SOCKET, EVENT NAME 'display.error' TO DISPLAY REJECT MESSAGE
//AT HERE, THE 'invitationOwnerId' AND 'invitationOwnerSocket'  REPRESENTED INVITATION OWNER'S SOCKET ID AND SOCKET
          socket.on('reject.invitation', (invitationOwnerId) => {
            let message = 'Invitee reject your invitation.';
            const invitationOwnerSocket = this.players[invitationOwnerId].socket;
            invitationOwnerSocket.emit('display.error', message);
          });

//IF USER CHOOSE RANDOM OPPONENT, FIND OPPONENT AND START GAME
          socket.on('random.opponent', (status) => {
            //CALLING FUNCTION: INSERT OR UPDATE THE CURRENT CLIENT'S INFO TO 'players' AND 'unmatched'
            this.joinGameForRandomOpponent(socket);
            //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
            const opponent = this.opponentOf(socket);
            //IF FOUND OPPONENT THEN START GAME
            this.startGame(socket, opponent);
            this.gameSession(socket);
          });

//RECEIVE CHAT MESSAGE EVENT NAME 'chat.message', DISPLAY TO BOTH SIDE
          socket.on('chat.message', (message) =>{
            const opponent = this.opponentOf(socket);
            if (!opponent) return;
            let obj = {name, message}
            socket.emit('chat.message', obj);
            opponent.emit('chat.message', obj);
          })

//DISCONNECTED (WHEN CLIENT DISCONNECT, AUTO RECEIVE FROM CLIENT'S SOCKET, EVENT NAME 'disconnect')
              socket.on('disconnect', () => {
                ////WHEN THE CURRENT CLIENT'S SOCKET DISCONNECTED, CONSOLE DISPLAY SOCKET ID
                console.log(`Client disconnected. Client ID:${clientId}   Client Name: ${name}  Socket ID: ${id}`);
                //SEND TO ALL CLIENTS, THE CURRENT CLIENT'S EVENT NAME 'client.disconnect'
                //AND PASS SOCKET ID TO ALL CLIENTS
                socket.broadcast.emit('client.disconnect', id);
                if(this.players[id]){
                  //CALLING FUNCTION: RETURN OPPONENT SOCKET OR RETURN NULL MEANS NO OPPONENT
                  const opponent = this.opponentOf(socket);
                  //IF HAS, SEND TO THE OPPONENT, THE CURRENT CLIENT'S EVENT NAME 'opponent.left'
                  //AND PASS THE CURRENT CLIENT'S NAME TO OPPONENT
                  if (opponent) {
                    opponent.emit('opponent.left', {
                      opponentName: this.players[id].name,
                    });
                    //SEND DISCONNECT MESSAGE TO BOTH SIDE, EVENT NAME 'connection.status'
                    socket.emit('connection.status', '🔴 <i>' + this.players[id].name + ' left the chat.</i>');
                    opponent.emit('connection.status', '🔴 <i>' + this.players[id].name + ' left the chat.</i>');
                  }
                }
                //DELETE FROM 'clients', 'players' and 'unmatched'
                delete this.players[id];
                this.unmatched = this.unmatched.filter((element) => element !== id);
                this.clients = this.clients.filter((element) => element !== clientId);
                delete this.emailandSocketId[email];
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

  joinGameForRandomOpponent(socket) {
    try {
      const { id } = socket;
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
      throw new Error(`JoinGameForRandomOpponent Error: ${error.message}`);
    }
  }

  async joinGameForInviteOpponent(socket, email, inputEmail) {
    try {
      const { id } = socket;
      //USE INPUT EMAIL TO FIND INVITEE SOCKET ID FROM 'emailandSocketId'
      let invitationOwnerId = this.emailandSocketId[inputEmail];
      //DO INPUT VALIDATION FOR THE INVITEE'S EMAIL
      let self = inputEmail === email;
      let matched = this.unmatched.includes(invitationOwnerId);
      const emailFormat = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
      let err = '';
      if (!inputEmail)
        err = 'Please enter an email.';
      else if (!emailFormat.test(inputEmail))
        err = 'Wrong email format.';
      else if (self)
        err = 'Email invalid.';
      else if(!invitationOwnerId){
        const [userResult] = await mysql.execute(query.searchUserByEmail, [inputEmail]);
        if (userResult.length <= 0)
          err = 'Cannot find this player.';
        else
          err = 'Player is not in game session.';
      }
      else if (invitationOwnerId && matched)
        err = 'The player has already in other challenge.'
      else if (invitationOwnerId && !matched) {
        //IF EMAIL CORRECT AND THE PLAYER DONT HAVE MATCH,
        //SEND TO INVITEE'S SOCKET, EVENT NAME 'request.invitation' TO REQUEST ACCEPT, PASS CLIENT'S SOCKET ID
        //AND SEND TO CLIENT'S SOCKET, EVENT NAME 'waiting.accept' TO SHOW WAITING MESSAGE
        let reqMessage = this.players[id].name + ' invite you to have a challenge, accept?';
        let waitingMessage = 'Invited. Please wait for invitee accept.';
        const invitationOwnerSocket = this.players[invitationOwnerId].socket;
        invitationOwnerSocket.emit('request.invitation', { reqMessage, id });
        socket.emit('waiting.accept', waitingMessage);
      }
      if (err) {
        //SEND TO CLIENT'S SOCKET, EVENT NAME 'display.error' TO DISPLAY ERROR MESSAGE FOR FAIL INVITATION
        socket.emit('display.error', err);
      }
    }
    catch (error) {
      throw new Error(`JoinGameForInviteOpponent Error: ${error.message}`);
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

  startGame(socket, opponent){
    if (opponent) {
      const { id } = socket;
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
      //SEND CONNECT MESSAGE TO BOTH SIDE, EVENT NAME 'connection.status'
      socket.emit('connection.status', '🔵 <i>' + this.players[id].name + ' join the chat.</i>');
      opponent.emit('connection.status', '🔵 <i>' + this.players[opponent.id].name + ' join the chat.</i>');
      socket.emit('connection.status', '🔵 <i>' + this.players[opponent.id].name + ' join the chat.</i>');
      opponent.emit('connection.status', '🔵 <i>' + this.players[id].name + ' join the chat.</i>');
    }
  }

  gameSession(socket){
    const { id } = socket;
    const { clientId, name } = socket.handshake.query;

//REQUEST RECHALLENGE (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'request.rechallenge')
    //CHECK WHETHER THE CURRENT CLIENT HAS AN OPPONENT OR NOT
    //IF HAS, SEND TO OPPONENT, OPPONENT'S SOCKET'S EVENT NAME 'rechallenge.request'
    //AND PASS REQUEST MSG TO OPPONENT
    socket.on('request.rechallenge', (reqMessage) => {
      const opponent = this.opponentOf(socket);
      if (!opponent) return;
      opponent.emit('rechallenge.request', reqMessage);
    });

//CONFIRM RECHALLENGE WITH SAME OPPONENT, RESTART GAME (RECEIVE FROM CURRENT CLIENT'S SOCKET, EVENT NAME 'restart.game')
    socket.on('restart.game', (reqMessage) => {
      const opponent = this.opponentOf(socket);
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
      const [userResult] =  await mysql.execute(query.searchUserById, [this.players[id].clientId]);
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
          const doneInsertScore = await mysql.execute(query.insertScore, [this.players[id].clientId, this.players[opponent.id].clientId, gameResult]);
          const doneUpdateUserScore = await mysql.execute(query.updateUserScore, [total_played, total_win, percentage, this.players[id].clientId]);
          if (doneInsertScore && doneUpdateUserScore)
            socket.emit('score.inserted', {opponentName, gameResult, total_played, total_win, percentage});
        }
        else
          socket.emit('score.noupdate', {total_played, total_win, percentage});
      }
   });
  }

}

module.exports = Socket;
