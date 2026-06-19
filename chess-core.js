(() => {
"use strict";
const START_FEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const VALUES={p:100,n:320,b:330,r:500,q:900,k:20000};
const FILES="abcdefgh";

function colorOf(p){return p&&p===p.toUpperCase()?"w":"b"}
function opponent(c){return c==="w"?"b":"w"}
function rc(i){return[Math.floor(i/8),i%8]}
function idx(r,c){return r*8+c}
function inside(r,c){return r>=0&&r<8&&c>=0&&c<8}
function indexToAlgebraic(i){const[r,c]=rc(i);return FILES[c]+(8-r)}
function algebraicToIndex(a){if(!/^[a-h][1-8]$/.test(a))throw Error("Kotak FEN tidak valid");return idx(8-Number(a[1]),FILES.indexOf(a[0]))}
function cloneState(s){return{board:s.board.slice(),turn:s.turn,castling:s.castling,ep:s.ep,halfmove:s.halfmove,fullmove:s.fullmove}}

function parseFEN(fen){
  const parts=fen.trim().split(/\s+/);if(parts.length<4)throw Error("FEN tidak lengkap");
  const rows=parts[0].split("/");if(rows.length!==8)throw Error("Papan FEN tidak valid");
  const board=[];
  for(const row of rows){let n=0;for(const ch of row){if(/[1-8]/.test(ch)){for(let i=0;i<Number(ch);i++){board.push(null);n++}}else if(/[prnbqkPRNBQK]/.test(ch)){board.push(ch);n++}else throw Error("Karakter FEN tidak valid")}if(n!==8)throw Error("Baris FEN tidak valid")}
  const turn=parts[1];if(!["w","b"].includes(turn))throw Error("Giliran FEN tidak valid");
  const state={board,turn,castling:parts[2]==="-"?"":parts[2],ep:parts[3]==="-"?null:algebraicToIndex(parts[3]),halfmove:Number(parts[4]||0),fullmove:Number(parts[5]||1)};
  if(board.filter(x=>x==="K").length!==1||board.filter(x=>x==="k").length!==1)throw Error("FEN harus memiliki dua raja");
  return state
}
function toFEN(s){
  let placement="";
  for(let r=0;r<8;r++){let empty=0;for(let c=0;c<8;c++){const p=s.board[idx(r,c)];if(!p)empty++;else{if(empty){placement+=empty;empty=0}placement+=p}}if(empty)placement+=empty;if(r<7)placement+="/"}
  return`${placement} ${s.turn} ${s.castling||"-"} ${s.ep===null?"-":indexToAlgebraic(s.ep)} ${s.halfmove} ${s.fullmove}`
}
function positionKey(s){return toFEN({...s,halfmove:0,fullmove:1}).split(" ").slice(0,4).join(" ")}
function kingSquare(s,color){return s.board.indexOf(color==="w"?"K":"k")}

function isSquareAttacked(s,square,byColor){
  const[r,c]=rc(square),pawnDir=byColor==="w"?-1:1;
  for(const dc of[-1,1]){const rr=r-pawnDir,cc=c-dc;if(inside(rr,cc)){const p=s.board[idx(rr,cc)];if(p&&colorOf(p)===byColor&&p.toLowerCase()==="p")return true}}
  for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){const rr=r+dr,cc=c+dc;if(inside(rr,cc)){const p=s.board[idx(rr,cc)];if(p&&colorOf(p)===byColor&&p.toLowerCase()==="n")return true}}
  for(const[dr,dc]of[[-1,-1],[-1,1],[1,-1],[1,1]]){let rr=r+dr,cc=c+dc;while(inside(rr,cc)){const p=s.board[idx(rr,cc)];if(p){if(colorOf(p)===byColor&&["b","q"].includes(p.toLowerCase()))return true;break}rr+=dr;cc+=dc}}
  for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){let rr=r+dr,cc=c+dc;while(inside(rr,cc)){const p=s.board[idx(rr,cc)];if(p){if(colorOf(p)===byColor&&["r","q"].includes(p.toLowerCase()))return true;break}rr+=dr;cc+=dc}}
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(inside(rr,cc)){const p=s.board[idx(rr,cc)];if(p&&colorOf(p)===byColor&&p.toLowerCase()==="k")return true}}
  return false
}
function isKingInCheck(s,color){const k=kingSquare(s,color);return k>=0&&isSquareAttacked(s,k,opponent(color))}

function pseudoMoves(s,fromOnly=null){
  const moves=[];
  for(let from=0;from<64;from++){
    if(fromOnly!==null&&from!==fromOnly)continue;
    const piece=s.board[from];if(!piece||colorOf(piece)!==s.turn)continue;
    const color=s.turn,[r,c]=rc(from),type=piece.toLowerCase();
    const push=(to,extra={})=>{const target=s.board[to];if(target&&colorOf(target)===color)return;moves.push({from,to,piece,capture:target||null,...extra})};
    if(type==="p"){
      const dir=color==="w"?-1:1,start=color==="w"?6:1,promo=color==="w"?0:7,one=r+dir;
      if(inside(one,c)&&!s.board[idx(one,c)]){const to=idx(one,c);if(one===promo)for(const promotion of["q","r","b","n"])push(to,{promotion});else push(to);const two=r+2*dir;if(r===start&&!s.board[idx(two,c)])push(idx(two,c),{doublePawn:true})}
      for(const dc of[-1,1]){const rr=r+dir,cc=c+dc;if(!inside(rr,cc))continue;const to=idx(rr,cc),target=s.board[to];if(target&&colorOf(target)!==color){if(rr===promo)for(const promotion of["q","r","b","n"])push(to,{promotion});else push(to)}else if(s.ep===to)moves.push({from,to,piece,capture:color==="w"?"p":"P",enPassant:true})}
    }else if(type==="n"){
      for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){const rr=r+dr,cc=c+dc;if(inside(rr,cc))push(idx(rr,cc))}
    }else if(["b","r","q"].includes(type)){
      const dirs=[];if(["b","q"].includes(type))dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);if(["r","q"].includes(type))dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for(const[dr,dc]of dirs){let rr=r+dr,cc=c+dc;while(inside(rr,cc)){const to=idx(rr,cc),target=s.board[to];if(!target)moves.push({from,to,piece,capture:null});else{if(colorOf(target)!==color)moves.push({from,to,piece,capture:target});break}rr+=dr;cc+=dc}}
    }else if(type==="k"){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(inside(rr,cc))push(idx(rr,cc))}
      const enemy=opponent(color);
      if(color==="w"&&from===60&&!isKingInCheck(s,"w")){
        if(s.castling.includes("K")&&!s.board[61]&&!s.board[62]&&s.board[63]==="R"&&!isSquareAttacked(s,61,enemy)&&!isSquareAttacked(s,62,enemy))moves.push({from,to:62,piece,castle:"K",capture:null});
        if(s.castling.includes("Q")&&!s.board[59]&&!s.board[58]&&!s.board[57]&&s.board[56]==="R"&&!isSquareAttacked(s,59,enemy)&&!isSquareAttacked(s,58,enemy))moves.push({from,to:58,piece,castle:"Q",capture:null})
      }
      if(color==="b"&&from===4&&!isKingInCheck(s,"b")){
        if(s.castling.includes("k")&&!s.board[5]&&!s.board[6]&&s.board[7]==="r"&&!isSquareAttacked(s,5,enemy)&&!isSquareAttacked(s,6,enemy))moves.push({from,to:6,piece,castle:"K",capture:null});
        if(s.castling.includes("q")&&!s.board[3]&&!s.board[2]&&!s.board[1]&&s.board[0]==="r"&&!isSquareAttacked(s,3,enemy)&&!isSquareAttacked(s,2,enemy))moves.push({from,to:2,piece,castle:"Q",capture:null})
      }
    }
  }
  return moves
}
function applyMove(s,m){
  const n=cloneState(s),color=s.turn,piece=n.board[m.from],target=n.board[m.to];n.board[m.from]=null;
  if(m.enPassant)n.board[m.to+(color==="w"?8:-8)]=null;
  n.board[m.to]=m.promotion?(color==="w"?m.promotion.toUpperCase():m.promotion):piece;
  if(m.castle){if(m.to===62){n.board[63]=null;n.board[61]="R"}else if(m.to===58){n.board[56]=null;n.board[59]="R"}else if(m.to===6){n.board[7]=null;n.board[5]="r"}else if(m.to===2){n.board[0]=null;n.board[3]="r"}}
  let rights=n.castling;if(piece==="K")rights=rights.replace(/[KQ]/g,"");if(piece==="k")rights=rights.replace(/[kq]/g,"");if(m.from===63||m.to===63)rights=rights.replace("K","");if(m.from===56||m.to===56)rights=rights.replace("Q","");if(m.from===7||m.to===7)rights=rights.replace("k","");if(m.from===0||m.to===0)rights=rights.replace("q","");
  n.castling=rights;n.ep=m.doublePawn?(m.from+m.to)/2:null;n.halfmove=(piece.toLowerCase()==="p"||target||m.enPassant)?0:n.halfmove+1;if(color==="b")n.fullmove++;n.turn=opponent(color);return n
}
function legalMoves(s,fromOnly=null){const color=s.turn;return pseudoMoves(s,fromOnly).filter(m=>!isKingInCheck(applyMove(s,m),color))}
function sameMove(a,b){return a&&b&&a.from===b.from&&a.to===b.to&&(a.promotion||null)===(b.promotion||null)}

function san(s,m,after=applyMove(s,m)){
  let out="";
  if(m.castle)out=m.castle==="K"?"O-O":"O-O-O";
  else{
    const type=m.piece.toLowerCase();
    if(type!=="p")out+=m.piece.toUpperCase();
    const ambiguous=legalMoves(s).filter(x=>x.from!==m.from&&x.to===m.to&&x.piece.toLowerCase()===type);
    if(type!=="p"&&ambiguous.length){const[fr,fc]=rc(m.from),sameFile=ambiguous.some(x=>rc(x.from)[1]===fc),sameRank=ambiguous.some(x=>rc(x.from)[0]===fr);if(!sameFile)out+=FILES[fc];else if(!sameRank)out+=(8-fr);else out+=indexToAlgebraic(m.from)}
    if(type==="p"&&(m.capture||m.enPassant))out+=FILES[rc(m.from)[1]];
    if(m.capture||m.enPassant)out+="x";out+=indexToAlgebraic(m.to);if(m.promotion)out+="="+m.promotion.toUpperCase()
  }
  if(isKingInCheck(after,after.turn))out+=legalMoves(after).length?"+":"#";
  return out
}
function insufficient(s){
  const pieces=s.board.filter(Boolean);if(pieces.some(p=>["p","r","q"].includes(p.toLowerCase())))return false;
  const minors=pieces.filter(p=>["b","n"].includes(p.toLowerCase()));if(minors.length<=1)return true;
  if(minors.every(p=>p.toLowerCase()==="b")){const colors=[];s.board.forEach((p,i)=>{if(p&&p.toLowerCase()==="b"){const[r,c]=rc(i);colors.push((r+c)%2)}});return colors.every(x=>x===colors[0])}
  return false
}
function status(s,repetitionCount=0){
  const legal=legalMoves(s);if(!legal.length)return isKingInCheck(s,s.turn)?{over:true,result:s.turn==="w"?"0-1":"1-0",reason:"Skakmat"}:{over:true,result:"1/2-1/2",reason:"Stalemate"};
  if(s.halfmove>=100)return{over:true,result:"1/2-1/2",reason:"Remis aturan 50 langkah"};
  if(repetitionCount>=3)return{over:true,result:"1/2-1/2",reason:"Pengulangan posisi tiga kali"};
  if(insufficient(s))return{over:true,result:"1/2-1/2",reason:"Materi tidak cukup"};
  return{over:false}
}
window.ChessCore={START_FEN,VALUES,colorOf,opponent,rc,idx,inside,indexToAlgebraic,algebraicToIndex,cloneState,parseFEN,toFEN,positionKey,kingSquare,isSquareAttacked,isKingInCheck,pseudoMoves,applyMove,legalMoves,sameMove,san,insufficient,status};
})();