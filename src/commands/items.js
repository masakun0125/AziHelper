const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('items')
    .setDescription('すべてのアイテムを一覧表示する'),

  async execute(interaction) {
    await interaction.deferReply();

    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true });

    if (error || !items || items.length === 0) {
      return interaction.editReply('❌ アイテムが登録されていません。');
    }

    const chunks = [];
    for (let i = 0; i < items.length; i += 10) {
      chunks.push(items.slice(i, i + 10));
    }

    const embeds = chunks.map((chunk, pageIndex) => {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📦 アイテム一覧 (${pageIndex + 1}/${chunks.length})`)
        .setTimestamp();

      const fields = chunk.map(item => ({
        name: item.name,
        value: `🔗 \`/item ${item.name}\``,
        inline: true,
      }));

      embed.addFields(fields);
      return embed;
    });

    return interaction.editReply({ embeds: [embeds[0]] });
  },
};
