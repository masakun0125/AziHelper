const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('管理者一覧を表示する'),

  async execute(interaction) {
    await interaction.deferReply();

    const { data: admins, error } = await supabase
      .from('admins')
      .select('*')
      .order('added_at', { ascending: false });

    if (error || !admins || admins.length === 0) {
      return interaction.editReply('❌ 管理者が登録されていません。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('👨‍💼 管理者一覧')
      .setTimestamp();

    const fields = admins.map((admin, index) => ({
      name: `${index + 1}. Discord ID`,
      value: admin.discord_id,
      inline: false,
    }));

    embed.addFields(fields);

    return interaction.editReply({ embeds: [embed] });
  },
};
