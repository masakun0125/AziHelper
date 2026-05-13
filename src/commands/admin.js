const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const supabase = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('staff一覧を表示する'),

  async execute(interaction) {

    await interaction.deferReply();

    const { data: staffs, error } = await supabase
      .from('admins')
      .select('*')
      .order('added_at', {
        ascending: false,
      });

    if (error || !staffs || staffs.length === 0) {
      return interaction.editReply(
        '❌ staffが登録されていません。'
      );
    }

    // roleごとに分離
    const admins = staffs.filter(
      s => s.role === 'admin'
    );

    const editors = staffs.filter(
      s => s.role === 'editor'
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('StaffList')
      .setTimestamp();

    // admin欄
    embed.addFields({
      name: 'Admin',

      value:
        admins.length > 0
          ? admins
              .map(
                a =>
                  `• <@${a.discord_id}> (\`${a.discord_id}\`)`
              )
              .join('\n')
          : 'なし',

      inline: false,
    });

    // editor欄
    embed.addFields({
      name: 'Editor',

      value:
        editors.length > 0
          ? editors
              .map(
                e =>
                  `• <@${e.discord_id}> (\`${e.discord_id}\`)`
              )
              .join('\n')
          : 'なし',

      inline: false,
    });

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
