const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradelocation-edit')
    .setDescription('アイテムの取引場所を編集する（管理者のみ）')
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
    )
    .addStringOption(opt =>
      opt.setName('location')
        .setDescription('新しい取引場所')
        .setRequired(true)
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
    const newLocation = interaction.options.getString('location');

    // 既存の取引場所情報を取得
    const { data: existing } = await supabase
      .from('trade_locations')
      .select('*')
      .eq('item_name', itemname)
      .eq('server', server)
      .single();

    if (!existing) {
      return interaction.editReply(`❌ \`${itemname}\` (${server}) の取引場所が登録されていません。`);
    }

    // 更新
    const { error } = await supabase
      .from('trade_locations')
      .update({ location: newLocation })
      .eq('item_name', itemname)
      .eq('server', server);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 編集中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${itemname}\` (${server}) の取引場所を編集しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
