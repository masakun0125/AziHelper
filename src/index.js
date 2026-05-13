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

const checkAdmin = require('./lib/checkAdmin');

// ─────────────────────────────────────────────
// Express
// ─────────────────────────────────────────────
const app = express();

app.get('/', (_, res) => {
  res.send('Bot is alive!');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `[Health] Server listening on port ${
      process.env.PORT || 3000
    }`
  );
});

// ─────────────────────────────────────────────
// Discord Client
// ─────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// ─────────────────────────────────────────────
// Cooldown
// ─────────────────────────────────────────────
const cooldowns = new Map();

// ─────────────────────────────────────────────
// コマンド読み込み
// ─────────────────────────────────────────────
const commandsPath = path.join(
  __dirname,
  'commands'
);

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(f => f.endsWith('.js'));

const commandsData = [];

for (const file of commandFiles) {

  const command = require(
    path.join(commandsPath, file)
  );

  client.commands.set(
    command.data.name,
    command
  );

  commandsData.push(
    command.data.toJSON()
  );
}

// ─────────────────────────────────────────────
// Slash Command Register
// ─────────────────────────────────────────────
client.once('ready', async () => {

  console.log(
    `[Bot] Logged in as ${client.user.tag}`
  );

  const rest = new REST({
    version: '10',
  }).setToken(
    process.env.DISCORD_TOKEN
  );

  try {

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commandsData,
      }
    );

    console.log(
      '[Bot] Slash commands registered.'
    );

  } catch (err) {

    console.error(
      '[Bot] Failed to register commands:',
      err
    );

  }
});

// ─────────────────────────────────────────────
// Interaction
// ─────────────────────────────────────────────
client.on(
  'interactionCreate',
  async interaction => {

    // =========================================
    // AUTOCOMPLETE
    // =========================================
    if (interaction.isAutocomplete()) {

      const command =
        client.commands.get(
          interaction.commandName
        );

      if (command?.autocomplete) {

        try {

          await command.autocomplete(
            interaction
          );

        } catch (err) {

          console.error(
            `[Autocomplete Error] ${interaction.commandName}:`,
            err
          );

        }
      }

      return;
    }

    // =========================================
    // BUTTON
    // =========================================
    if (interaction.isButton()) {

      const [type, ...rest] =
        interaction.customId.split(':');

      const itemName =
        rest.join(':');

      if (type === 'recipe') {

        await interaction.deferReply();

        const {
          buildRecipeEmbed,
        } = require('./commands/recipe');

        const result =
          await buildRecipeEmbed(
            itemName
          );

        if (!result || result.notFound) {

          return interaction.editReply(
            `❌ \`${itemName}\` のレシピは登録されていません。`
          );
        }

        return interaction.editReply({
          embeds: [result.embed],
          components: result.components,
        });
      }

      return;
    }

    // =========================================
    // SLASH COMMAND
    // =========================================
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command =
      client.commands.get(
        interaction.commandName
      );

    if (!command) {
      return;
    }

    // =========================================
    // ROLE CHECK
    // =========================================

    // editor以上必要
    const staffCommands = [

      'item-add',
      'item-edit',
      'item-delete',

      'recipe-add',
      'recipe-edit',
      'recipe-delete',

      'location-add',
      'tradelocation-add',

      'tex-add',
      'tex-delete',
    ];

    // admin専用
    const adminCommands = [
      'staff-add',
      'staff-remove',
    ];

    const staff =
      await checkAdmin(
        interaction.user.id
      );

    // =========================================
    // DM制限
    // editor以上のみDM使用可能
    // =========================================
    if (!interaction.guild && !staff) {

      return interaction.reply({
        content:
          '❌ ダイレクトメッセージでのコマンドの実行は、スタッフを除き受け付けていません。',
        ephemeral: true,
      });
    }

    // =========================================
    // ADMIN ONLY
    // =========================================
    if (
      adminCommands.includes(
        interaction.commandName
      )
    ) {

      const isOwner =
        interaction.guild?.ownerId ===
        interaction.user.id;

      if (
        (!staff ||
          staff.role !== 'admin') &&
        !isOwner
      ) {

        return interaction.reply({
          content:
            '❌ admin専用コマンドです。',
          ephemeral: true,
        });
      }
    }

    // =========================================
    // STAFF ONLY
    // =========================================
    else if (
      staffCommands.includes(
        interaction.commandName
      )
    ) {

      if (!staff) {

        return interaction.reply({
          content:
            '❌ staff専用コマンドです。',
          ephemeral: true,
        });
      }
    }

    // =========================================
    // USER COOLDOWN
    // staff以外のみ
    // =========================================
    if (!staff) {

      const cooldownKey =
        `${interaction.user.id}`;

      const now = Date.now();

      const cooldown =
        cooldowns.get(cooldownKey);

      const cooldownTime = 1000;

      if (
        cooldown &&
        now - cooldown < cooldownTime
      ) {

        const remain =
          (
            (cooldownTime -
              (now - cooldown)) / 1000
          ).toFixed(1);

        return interaction.reply({
          content:
            `クールダウン中です。\`${remain}秒\` 待ってください。`,
          ephemeral: true,
        });
      }

      cooldowns.set(
        cooldownKey,
        now
      );
    }

    // =========================================
    // EXECUTE
    // =========================================
    try {

      await command.execute(
        interaction
      );

    } catch (err) {

      console.error(
        `[Command Error] ${interaction.commandName}:`,
        err
      );

      const msg = {
        content:
          '❌ コマンド実行中にエラーが発生しました。',
        ephemeral: true,
      };

      try {

        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.editReply(
            msg
          );

        } else {

          await interaction.reply(
            msg
          );

        }

      } catch {}
    }
  }
);

client.login(
  process.env.DISCORD_TOKEN
);
