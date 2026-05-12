const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipe-delete')
    .setDescription('レシピを削除する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('itemname')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const { data: recipes } = await supabase
      .from('recipes')
      .select('item_name')
      .ilike('item_name', `%${focused}%`)
      .limit(25);

    await interaction.respond(
      (recipes || []).map(r => ({ name: r.item_name, value: r.item_name }))
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

    const itemname = interaction.options.getString('itemname');

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('item_name', itemname);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 削除中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`✅ \`${itemname}\` のレシピを削除しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
