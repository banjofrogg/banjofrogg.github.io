(() => {
  var mode, player, board, turn, actions, enpassant, castle, selected, clock, endTimes, count;
  
  var pieces = document.getElementsByClassName("board")[0];
  var pieceTypes = ["p", "n", "b", "r", "q", "k"];
  pieceTypes = [, ...pieceTypes.map(e => "w" + e), ...pieceTypes.map(e => "b" + e)];
  
  var playerChoice = 0;
  var timer = 600000;
  var timers = [...document.getElementsByClassName("timer")];
  
  var menu = document.getElementsByClassName("menu")[0];
  
  menu.children[0].addEventListener("click", () => {
    if(mode == "local") endGame((turn == 1 ? "White" : "Black") + " Resigned");
    else {
      endGame((player == 1 ? "White" : "Black") + " Resigned");
      channel.send("resign");
    }
  });
  
  menu.children[1].addEventListener("click", () => {
    menu.children[1].classList.add("hidden");
    menu.children[0].classList.remove("hidden");
    if(mode == "local") {
      if(playerChoice == 0) player = Math.random() >= 0.5 ? 1 : -1;
      else player = playerChoice;
      newGame();
    } else {
      if(playerChoice == 0) player = Math.random() >= 0.5 ? 1 : -1;
      else player = playerChoice;
      channel.send(timer);
      channel.send(player * -1);
      newGame();
    }
  });
  
  var settings = document.getElementsByClassName("settingsMenu")[0];
  var blanket = document.getElementsByClassName("blanket")[0];
  [...document.body.getElementsByClassName("settings")].forEach(e => e.addEventListener("click", () => {
    settings.classList.toggle("hidden");
    blanket.classList.toggle("hidden");
  }));
  
  [...settings.children[2].children].forEach((e, i) => e.addEventListener("click", () => {
    timer = [60000, 300000, 600000, 5999000][i];
    [...settings.children[2].children].forEach(e => e.classList.remove("selected"));
    e.classList.add("selected");
  }));
  
  [...settings.children[4].children].forEach((e, i) => e.addEventListener("click", () => {
    playerChoice = [1, -1, 0][i];
    [...settings.children[4].children].forEach(e => e.classList.remove("selected"));
    e.classList.add("selected");
  }));
  
  [...settings.children[6].children].forEach((e, i) => e.addEventListener("click", () => {
    changeTheme(...[["#000033", "darkblue"], ["#330000", "darkred"], ["#003300", "darkgreen"],
                    ["#330033", "darkviolet"], ["#111111", "#333333"]][i]);
  }));
  
  settings.children[8].children[0].addEventListener("click", async () => {
    mode = "remote";
    let hid = Math.floor(268435456 + Math.random() * 4026531839).toString(16);
    history.pushState({}, "", "?h" + hid);
    menu.children[0].classList.add("hidden");
    menu.children[2].innerHTML += "<strong>" + location.href.replace("/?h", "/?") + "</strong>";
    menu.children[2].classList.remove("hidden");
    start();
    await connect("h" + hid, hid, true);
    setTimeout(() => {
      channel.send(timer);
      channel.send(player * -1);
    }, 500);
    menu.children[2].classList.add("hidden");
    menu.children[0].classList.remove("hidden");
    newGame();
  });
  
  settings.children[8].children[1].addEventListener("click", () => {
    mode = "local";
    start();
    newGame();
  });
  
  function onMessage(msg) {
    console.log(msg);
    if(msg.includes(",")) nextTurn(...msg.split(",").map(e => parseInt(e)));
    else if(msg == "resign") endGame((player == 1 ? "Black" : "White") + " Resigned");
    else if(isNaN(parseInt(msg))) {
  
    } else if(msg > 59999) timer = parseInt(msg);
    else {
      player = parseInt(msg);
      menu.children[2].classList.add("hidden");
      menu.children[0].classList.remove("hidden");
      newGame();
    }
  }
  
  function start() {
    settings.children[9].classList.remove("hidden");
    settings.children[8].innerHTML = '<h2 class="title">​ Rules apply next game.</h2>';
    settings.classList.toggle("hidden");
    blanket.classList.toggle("hidden");
    if(playerChoice == 0) player = Math.random() >= 0.5 ? 1 : -1;
    else player = playerChoice;
  }
  
  function changeTheme(bgColor, boardColor) {
    document.documentElement.style.background = bgColor;
    document.body.style.background = bgColor;
    pieces.style.backgroundColor = boardColor;
  }
  
  function newGame() {
    let boardState = [
      new Uint8Array([4, 2, 3, ...(player > 0 ? [5, 6] : [6, 5]), 3, 2, 4]),
      new Uint8Array(8).fill(1),
      new Uint8Array(8),
      new Uint8Array(8),
    ];
    for(let i = 3; i >= 0; --i) boardState.push(boardState[i].map(e => e > 0 ? e + 6 : 0));
    if(player > 0) boardState.reverse();
    board = boardState.map(e => new Proxy(e, {
      get(row, col) {
        if(col == "copy") return new Proxy(row.map(e => e), {
          get: this.get,
          set(row, col, piece) {
            row[col] = piece == 0 ? 0 : piece + 3 - 3 * turn;
            return true;
          }
        });
        if(!isNaN(col)) return row[col] == 0 ? 0 : turn == -1 ? row[col] - 6 : row[col];
        return e => {
          if(turn == -1) e += 6;
          return row[col](e);
        }
      },
  
      set(row, col, piece) {
        if(row[col] > 0) pieces.removeChild(document.elementFromPoint(pieces.offsetLeft + col * .125 * pieces.offsetWidth + 3, pieces.offsetTop + boardState.indexOf(row) * .125 * pieces.offsetHeight + 3));
        row[col] = piece == 0 ? 0 : piece + 3 - 3 * turn;
        if(piece > 0) {
          let html = document.createElement("div");
          html.innerHTML = '<div class="piece" style="background-image: url(\'https://cdn.glitch.global/6db799a4-c85b-4ba2-a5a7-f24a96c6af6e/' + pieceTypes[row[col]] + '.png\'); left:' + (col * 12.5) + '%; top:' + (boardState.indexOf(row) * 12.5) + '%">';
          pieces.appendChild(html.firstChild);
        }
        return true;
      }
    }));
    turn = -1;
    castle = {
      1: [true, true],
      "-1": [true, true]
    }
    enpassant = null;
    actions = null;
    selected = null;
    pieces.innerHTML = "";
    let end = [...document.body.children].find(e => e.nodeName == "H1");
    if(end) document.body.removeChild(end);
    for(let i = 0; i < 8; ++i)
      for(let j = 0; j < 8; ++j)
        if(boardState[i][j] > 0) pieces.innerHTML += '<div class="piece" style="background-image: url(\'https://cdn.glitch.global/6db799a4-c85b-4ba2-a5a7-f24a96c6af6e/' + pieceTypes[boardState[i][j]] + '.png\'); left:' + (j * 12.5) + '%; top:' + (i * 12.5) + '%">';
    pieces.addEventListener("click", handlePieces);
    if(timers[1].classList.contains("white") != (player == 1)) {
      timers[0].classList.toggle("white");
      timers[1].classList.toggle("white");
    }
    timers.forEach(e => {
      let time = new Date(timer);
      e.innerHTML = ("0" + ((time.getHours() - 1) * 60 + time.getMinutes())).slice(-2) + ":" + ("0" + time.getSeconds()).slice(-2);
      if(e.classList.contains("white")) e.classList.add("inactive");
      else e.classList.remove("inactive");
    });
    count = new Date().valueOf();
    endTimes = {
      1: count + timer,
      "-1": count + timer
    }
    clock = setInterval(() => {
      if(endTimes[turn] - new Date().valueOf() <= 0) endGame("Time Fail<br>" + (turn == 1 ? "Black" : "White") + " Wins");
      else {
        let time = new Date(endTimes[turn] - new Date().valueOf());
        timers[turn == player ? 1 : 0].innerHTML = ("0" + ((time.getHours() - 1) * 60 + time.getMinutes())).slice(-2) + ":" + ("0" + time.getSeconds()).slice(-2);
      }
    }, 100);
    nextTurn(10, 0, 0, 0);
  }
  
  function endGame(result) {
    let end = document.createElement("h1");
    end.innerHTML = result;
    end.style.position = "absolute";
    document.body.appendChild(end);
    pieces.removeEventListener("click", handlePieces);
    clearInterval(clock);
    menu.children[0].classList.add("hidden");
    if(!id) menu.children[1].classList.remove("hidden");
  }
  
  function handlePieces(event) {
    let piece = document.elementFromPoint(event.x, event.y);
    let loc = [piece.style.top.slice(0, -1) / 12.5, piece.style.left.slice(0, -1) / 12.5];
    [...pieces.getElementsByClassName("action")].forEach(e => pieces.removeChild(e));
    if(piece.className == "piece") {
      loc = actions.find(e => e[0][0] == loc[0] && e[0][1] == loc[1]);
      if(loc && (mode == "local" || turn == player)) {
        loc[1].forEach(e => {
          let html = document.createElement("div");
          html.innerHTML = '<div class="action" style="left:' + (e[1] * 12.5) + '%; top:' + (e[0] * 12.5) + '%">';
          pieces.appendChild(html.firstChild);
        });
        selected = loc[0];
      }
    } else if(piece.className == "action") {
      nextTurn(selected[0], selected[1], ...loc);
      if(mode == "remote") channel.send([selected[0], selected[1], ...loc].map(e => 7 - e));
    }
  }
  
  function nextTurn(x1, y1, x2, y2) {
    if(x1 != 10) {
      if(board[x1][y1] == 6) {
        castle[turn] = [false, false];
        if(y1 - y2 == 2) {
          board[x2][y2 + 1] = 4;
          board[x2][0] = 0;
        } else if(y1 - y2 == -2) {
          board[x2][y2 - 1] = 4;
          board[x2][7] = 0;
        }
      }
      board[x2][y2] = board[x1][y1];
      board[x1][y1] = 0;
      if(board[player == 1 ? 0 : 7][0] != (turn == 1 ? 10 : 4)) castle[player * turn * -1][0] = false;
      if(board[player == 1 ? 0 : 7][7] != (turn == 1 ? 10 : 4)) castle[player * turn * -1][1] = false;
      if(board[player == 1 ? 7 : 0][0] != (turn == 1 ? 4 : -2)) castle[player * turn][0] = false;
      if(board[player == 1 ? 7 : 0][7] != (turn == 1 ? 4 : -2)) castle[player * turn][1] = false;
      if(board[x2][y2] == 1) {
        if(x2 + "," + y2 == enpassant) {
          board[x2 + (turn == player ? 1 : -1)][y2] = 0;
        } else if(Math.abs(x1 - x2) == 2) {
          enpassant = (x2 - x1) / 2 + x1 + "," + y2;
        } else enpassant = null;
        if(x2 == (turn == player ? 0 : 7)) board[x2][y2] = 5;
      } else {
        enpassant = null;
      }
    }
    turn *= -1;
    actions = getMoves(turn);
    if(actions.length == 0) {
      let kingRow = board.findIndex(e => e.includes(6));
      let kingCol = board[kingRow].indexOf(6);
      endGame(isChecked(kingRow, kingCol, board, turn) ? "Checkmate<br>" + (turn == 1 ? "Black" : "White") + " Wins" : "Stalemate");
    } else {
      let now = new Date().valueOf();
      endTimes[turn] += now - count;
      count = now;
      timers[0].classList.toggle("inactive");
      timers[1].classList.toggle("inactive");
    }
  }
  
  function getMoves(color) {
    let activePieces = [];
    for(let i = 0; i < 8; ++i)
      for(let j = 0; j < 8; ++j)
        if(board[i][j] > 0 && board[i][j] < 7) {
          let moves = spaces(board[i][j], i, j, color, board);
          if(moves.length > 0) activePieces.push([[i, j], moves]);
        }
    for(let i = 0; i < activePieces.length; ++i)
      for(let j = activePieces[i][1].length - 1; j >= 0; --j) {
        let tempBoard = board.map(e => e.copy);
        tempBoard[activePieces[i][1][j][0]][activePieces[i][1][j][1]] = tempBoard[activePieces[i][0][0]][activePieces[i][0][1]];
        tempBoard[activePieces[i][0][0]][activePieces[i][0][1]] = 0;
        let kingRow = tempBoard.findIndex(e => e.includes(6));
        let kingCol = tempBoard[kingRow].indexOf(6);
        if(isChecked(kingRow, kingCol, tempBoard, color))
          if(activePieces[i][1].splice(j, 1).toString() == kingRow + "," + kingCol && kingRow == (color == player ? 7 : 0)) {
            let king = activePieces[i][1].map(e => e.toString()).indexOf(kingRow + "," + (kingCol - (activePieces[i][0][1] - kingCol) * 2));
            if(king != -1) activePieces[i][1].splice(king, 1);
          }
      }
    return activePieces.filter(e => e[1].length > 0);
  }
  
  function scout(i, j, color, board) {
    if(board[i][j] == 0) return 2;
    else if((board[i][j] > 6 || board[i][j] < 0) == (color == turn)) return 1;
    return 0;
  }
  
  function spaces(piece, i, j, color, board) {
    let moves = [];
    switch(piece) {
      case 1:
        let n = color * player * -1;
        if(j < 8 && scout(i + n, j + 1, color, board) == 1 || color != turn || enpassant == i + n + "," + (j + 1)) moves.push([i + n, j + 1]);
        if(j >= 0 && scout(i + n, j - 1, color, board) == 1 || color != turn || enpassant == i + n + "," + (j - 1)) moves.push([i + n, j - 1]);
        if(board[i + n][j] == 0 && color == turn) {
          moves.push([i + n, j]);
          if(i == (color == player ? 6 : 1) && board[i + n * 2][j] == 0) moves.push([i + n * 2, j]);
        }
        break;
      case 2:
        if(i < 6) {
          if(j > 0) moves.push([i + 2, j - 1]);
          if(j < 7) moves.push([i + 2, j + 1]);
        }
        if(i > 1) {
          if(j > 0) moves.push([i - 2, j - 1]);
          if(j < 7) moves.push([i - 2, j + 1]);
        }
        if(j < 6) {
          if(i > 0) moves.push([i - 1, j + 2]);
          if(i < 7) moves.push([i + 1, j + 2]);
        }
        if(j > 1) {
          if(i > 0) moves.push([i - 1, j - 2]);
          if(i < 7) moves.push([i + 1, j - 2]);
        }
        moves = moves.filter(e => scout(e[0], e[1], color, board) > 0);
        break;
      case 3:
        downright: for(let k = i + 1, l = j + 1; k < 8 && l < 8; k++, l++) {
          if(scout(k, l, color, board) == 0) break downright;
          moves.push([k, l]);
          if(scout(k, l, color, board) == 1) break downright;
        }
        upright: for(let k = i - 1, l = j + 1; k >= 0 && l < 8; k--, l++) {
          if(scout(k, l, color, board) == 0) break upright;
          moves.push([k, l]);
          if(scout(k, l, color, board) == 1) break upright;
        }
        downleft: for(let k = i + 1, l = j - 1; k < 8 && l >= 0; k++, l--) {
          if(scout(k, l, color, board) == 0) break downleft;
          moves.push([k, l]);
          if(scout(k, l, color, board) == 1) break downleft;
        }
        upleft: for(let k = i - 1, l = j - 1; k >= 0 && l >= 0; k--, l--) {
          if(scout(k, l, color, board) == 0) break upleft;
          moves.push([k, l]);
          if(scout(k, l, color, board) == 1) break upleft;
        }
        break;
      case 4:
        down: for(let k = i + 1; k < 8; k++) {
          if(scout(k, j, color, board) == 0) break down;
          moves.push([k, j]);
          if(scout(k, j, color, board) == 1) break down;
        }
        up: for(let k = i - 1; k >= 0; k--) {
          if(scout(k, j, color, board) == 0) break up;
          moves.push([k, j]);
          if(scout(k, j, color, board) == 1) break up;
        }
        right: for(let k = j + 1; k < 8; k++) {
          if(scout(i, k, color, board) == 0) break right;
          moves.push([i, k]);
          if(scout(i, k, color, board) == 1) break right;
        }
        left: for(let k = j - 1; k >= 0; k--) {
          if(scout(i, k, color, board) == 0) break left;
          moves.push([i, k]);
          if(scout(i, k, color, board) == 1) break left;
        }
        break;
      case 5:
        moves.push(...spaces(4, i, j, color, board));
        moves.push(...spaces(3, i, j, color, board));
        break;
      case 6:
        for(let k = (i == 0 ? 0 : -1); k < (i == 7 ? 1 : 2); k++)
          for(let l = (j == 0 ? 0 : -1); l < (j == 7 ? 1 : 2); l++)
            if(scout(i + k, j + l, color, board) > 0) moves.push([i + k, j + l]);
        if(color == turn && castle[color][0] && spaces(4, i, 0, color, board).toString().includes(i + "," + (j - 2) + "," + i + "," + (j - 1)) && !isChecked(i, j, board, color) && !isChecked(i, j + 1, board, color)) moves.push([i, j - 2, 1]);
        if(color == turn && castle[color][1] && spaces(4, i, 7, color, board).toString().includes(i + "," + (j + 2) + "," + i + "," + (j + 1)) && !isChecked(i, j, board, color) && !isChecked(i, j + 1, board, color)) moves.push([i, j + 2, 2]);
        break;
    }
    return moves;
  }
  
  function isChecked(i, j, board, color, test) {
    var enemyPieces = [];
    for(let k = 0; k < 8; k++)
      for(let l = 0; l < 8; l++)
        if(scout(k, l, color, board) == 1) enemyPieces.push(...spaces((board[k][l] + 6) % 6, k, l, color * -1, board));
    return enemyPieces.map(e => e.toString()).includes(i + "," + j);
  }
  
  var p2p, candidates, channel;
  
  async function signal(id, data) {
    await fetch("https://docs.google.com/forms/d/e/1FAIpQLSf29AcWwZNfxguSkLVmMmLMBe9b-nQhtB5tb5o9cYSRq_ijSA/formResponse?usp=pp_url&entry.469488510=" + id + ";" + data + "&submit=Submit", { "mode": "no-cors" });
  }
  
  async function receive(id, prev) {
    var data = await fetch("https://docs.google.com/spreadsheets/d/1zoXkKl_o3CrK1haw1NYa-KOXFcc5CzlkknIZlIq53Pg/gviz/tq?tqx=out:csv").then(e => e.text());
    data = data.slice(1,-1).replaceAll('""','"').split('"\n"').slice(1).map(e => (e.match(/","(.*)/) ?? [,";"])[1]).toReversed();
    let res = data.find(e => e.split(";")[0] == id);
    return !res || res.split(";")[1] == prev ? await new Promise(r => setTimeout(() => r(receive(id, prev)), 300)) : res.split(";")[1];
  }
  
  async function connect(localId, remoteId, host) {
    p2p = new RTCPeerConnection({ "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] });
    var ice = [];
    p2p.addEventListener("icecandidate", e => {
      if(e.candidate) ice.push(e.candidate);
    });
    p2p.addEventListener("iceconnectionstatechange", e => {
      if(e.target.iceConnectionState == "failed") e.target.restartIce();
    });
    if(!window.candidates) window.candidates = null;
    if(host) {
      channel = p2p.createDataChannel("data");
      channel.addEventListener("message", e => onMessage(e.data));
      const offer = await p2p.createOffer();
      p2p.setLocalDescription(offer);
      await signal(localId, JSON.stringify(offer));
    } else {
      p2p.addEventListener("datachannel", e => {
        channel = e.channel;
        channel.addEventListener("message", e => onMessage(e.data));
      });
    }
    var res = await receive(remoteId, candidates ?? "connected");
    var desc = new RTCSessionDescription(JSON.parse(res));
    try {
      var ufrag = desc.sdp.split("ice-ufrag:")[1].split("\r\n")[0];
      var pwd = desc.sdp.split("ice-pwd:")[1].split("\r\n")[0];
      desc.sdp = desc.sdp.replace(ufrag, ufrag.replaceAll(" ", "+")).replace(pwd, pwd.replaceAll(" ", "+"));
    } catch {
      console.log("No ice candidates found");
    }
    p2p.setRemoteDescription(desc);
    if(!host) {
      const answer = await p2p.createAnswer();
      p2p.setLocalDescription(answer);
      await signal(localId, JSON.stringify(answer));
      await new Promise(r => setTimeout(() => r(1), 500));
    }
    if(p2p.iceGatheringState == "complete") await signal(localId, JSON.stringify(ice));
    else await new Promise(r => {
      p2p.addEventListener("icegatheringstatechange", async e => {
        if(e.target.iceGatheringState == "complete") r(await signal(localId, JSON.stringify(ice)));
      })
    });
    candidates = await receive(remoteId, res);
    JSON.parse(candidates).forEach(async e => {
      try {
        await p2p.addIceCandidate(e);
      } catch {
        console.log("Cannot add candidate: " + JSON.stringify(e));
      }
    });
    if(p2p.connectionState == "connected") {
      setTimeout(() => signal(localId, "connected"), 200);
      candidates = null;
      return true;
    } else if(p2p.connectionState == "failed") return connect(localId, remoteId, host);
    else return new Promise(r => {
      p2p.addEventListener("connectionstatechange", async e => {
        if(e.target.connectionState == "connected") setTimeout(async () => {
          await signal(localId, "connected");
          candidates = null;
          r(true);
        }, 200);
        else if(e.target.connectionState == "failed") return connect(localId, remoteId, host);
      })
    });
  }
  
  var id = location.href.match(/\/\?(.*)$/);
  if(id) (async () => {
    mode = "remote";
    id = id[1];
    start();
    if(id[0] == "h") {
      await connect(id, id.slice(1), true);
      id = null;
      setTimeout(() => {
        channel.send(timer);
        channel.send(player * -1);
        newGame();
      }, 500);
    } else await connect(id, "h" + id, false);
  })();
})();
