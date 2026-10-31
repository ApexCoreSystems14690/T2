# Heli no celular (voo assistido)

- 16/10: Julio: "no PC é pra ser assim mesmo" — PC fica com potência manual (~50% pra pairar); assistência só no toque.
- 16/10: `ReplicatedStorage.Shared.VooAssistido` (novo): `novo`, `coletivo`, `toque`, `atitude`, `angulos`; SUBIDA_MAX 20, DESCIDA_MAX 18, PITCH_MAX 22, BANCO_MAX 30.
- 16/10: `ServerScriptService.Server.rotorKitModule.Controller`: bloco `vaAssistido` só em mobile — bolinhas HeliSubir/HeliDescer, joystick vira pitch/roll/yaw, motor liga sozinho, Engine_Button some.
- 16/10: Settings dos 5 helis restaurados (Aerobatics true, MaxBank 45, MaxPitch 30); republicar não muda nada.
- 16/10: Backup: `rotorKit_Controller_antes_vooassistido`, `HeliSettings_antes_vooassistido_1..5`.
- 16/10: Falta: testar o sentir no aparelho; publicar o Controller.
