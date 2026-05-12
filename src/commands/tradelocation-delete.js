const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradelocation-delete')
    .setDescription('アイテムの取引場所を削除する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('itemname')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('server')
        .setDescription('サーバー名')
        .setRequired(true)
        .addChoices(
          { name: 'life', value: 'life' },
          { name: 'liferesource', value: 'liferesource' },
          { name: 'lifepve', value: 'lifepve' }
        )
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

    const itemname = interaction.options.getString('itemname');
    const server = interaction.options.getString('server');

    const { error } = await supabase
      .from('trade_locations')
      .delete()
      .eq('item_name', itemname)
      .eq('server', server);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 削除中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`✅ \`${itemname}\` (${server}) の取引場所を削除しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
