# Stone Plate

Mesa virtual para TTRPG. Abra `index.html` para acessar as ferramentas privadas do mestre: mapa, tokens, iniciativa, configurações, personagens e combate.

Na área **Configurações**, importe MP3s para a biblioteca local e ajuste a reprodução, afinação, velocidade, loop, reverberação e eco. Os arquivos ficam armazenados no navegador usado para abrir o app. Use **Abrir tela dos jogadores** na seção de personagens para abrir `players.html` em outra janela. Mova essa janela para a segunda tela e projete-a manualmente. Os jogadores podem alternar entre o mapa e a tela de personagens; nenhum controle do mestre aparece nessa janela.

Personagens, mapa e iniciativa usam um estado único. Vincule um personagem pelo campo **Token do mapa**; projéteis com dano configurado reduzem a vitalidade do personagem atingido. O estado antigo é migrado automaticamente ao abrir o Stone Plate.