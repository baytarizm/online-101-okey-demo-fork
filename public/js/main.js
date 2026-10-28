'use strict';
const socket = io({transports:['websocket']});
const $ = id => document.getElementById(id);
let create = true;
const inviteCode = new URLSearchParams(location.search).get('room');
function mode(value) {
  create = value;
  $('createTab').classList.toggle('active',value); $('joinTab').classList.toggle('active',!value);
  $('codeField').hidden = value; $('options').hidden = !value;
  $('roomCode').required = !value;
  $('playBots').hidden = !value;
  $('playBots').disabled = !value || !socket.connected;
  $('enterButton').classList.toggle('primary',!value);
  $('enterButton').classList.toggle('subtle',value);
  $('enterButton').textContent = value ? 'Arkadaş masası kur →' : 'Masaya katıl →';
}
$('createTab').onclick = () => mode(true); $('joinTab').onclick = () => mode(false);
if (inviteCode) { mode(false); $('roomCode').value = inviteCode.toUpperCase(); }
try { $('playerName').value = localStorage.getItem('haysagOkeyName') || ''; } catch {}
socket.on('connect', () => { $('enterButton').disabled = false; mode(create); $('message').textContent = ''; });
socket.on('connect_error', () => { $('message').textContent = 'Bağlantı kurulamadı. Otomatik yeniden deneniyor…'; $('enterButton').disabled = true; $('playBots').disabled = true; });
socket.on('disconnect', () => { $('enterButton').disabled = true; $('playBots').disabled = true; $('message').textContent = 'Bağlantı yenileniyor…'; });
$('entryForm').onsubmit = event => {
  event.preventDefault(); $('enterButton').disabled = true; $('playBots').disabled = true; $('message').textContent = 'Masaya katılınıyor…';
  socket.emit('joinGame',{create, playerName:$('playerName').value.trim(), roomCode:$('roomCode').value.trim().toUpperCase(),
    withBots:create && event.submitter?.id==='playBots', teamMode:$('teamMode').checked, stackingMode:$('stackingMode').checked, penaltyMode:$('penaltyMode').checked});
};
socket.on('session', session => {
  try { sessionStorage.setItem('haysagOkeySession',JSON.stringify(session)); localStorage.setItem('haysagOkeyName',session.playerName); }
  catch { $('message').textContent = 'Oyuna katılmak için bu sitede oturum depolamasına izin verin.'; socket.disconnect(); return; }
  location.href = '/game?room=' + session.roomCode;
});
socket.on('gameError', data => { $('message').textContent = data.message; $('enterButton').disabled = !socket.connected; $('playBots').disabled = !socket.connected || !create; });
