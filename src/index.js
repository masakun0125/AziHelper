require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ── Express（UptimeRobot用ヘルスチェック） ──────────────────────
const app = express();
app.get('/', (_, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`[Health] Server listening on port ${process.env.PORT || 3000}`);
});

// ── Discord Client ─────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// ── コマンド読み込み ───────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

// ── スラッシュコマンド登録（起動時に毎回） ─────────────────────
client.once('ready', async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commandsData }
    );
    console.log('[Bot] Slash commands registered.');
  } catch (err) {
    console.error('[Bot] Failed to register commands:', err);
  }
});

// ── インタラクション処理 ───────────────────────────────────────
client.on('interactionCreate', async interaction => {
  // オートコンプリート
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`[Autocomplete Error] ${interaction.commandName}:`, err);
      }
    }
    return;
  }

  // ボタン（recipe:アイテム名 形式）
  if (interaction.isButton()) {
    const [type, ...rest] = interaction.customId.split(':');
    const itemName = rest.join(':'); // アイテム名にコロンが含まれる場合も対応

    if (type === 'recipe') {
      await interaction.deferReply();
      const { buildRecipeEmbed } = require('./commands/recipe');
      const result = await buildRecipeEmbed(itemName);

      if (!result || result.notFound) {
        return interaction.editReply(`❌ \`${itemName}\` のレシピは登録されていません。`);
      }
      return interaction.editReply({ embeds: [result.embed], components: result.components });
    }

    return;
  }

  // スラッシュコマンド
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Command Error] ${interaction.commandName}:`, err);
    const msg = { content: '❌ コマンドの実行中にエラーが発生しました。', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
