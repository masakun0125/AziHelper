const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-delete')
    .setDescription('アイテムを削除する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const { data: items } = await supabase
      .from('items')
      .select('name')
      .ilike('name', `%${focused}%`)
      .limit(25);

    await interaction.respond(
      (items || []).map(i => ({ name: i.name, value: i.name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isAdmin = await checkAdmin(interaction.user.id);
    if (!isAdmin) {
      return interaction.editReply({
        content: '❌ このコマンドは管理者のみ使用できます。',
      });
    }

    const name = interaction.options.getString('name');

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('name', name);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 削除中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`✅ \`${name}\` を削除しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
