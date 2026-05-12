const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('location-edit')
    .setDescription('アイテムのドロップ場所を編集する（管理者のみ）')
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
        .setDescription('新しいドロップ場所')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('mob')
        .setDescription('新しいモブ')
        .setRequired(false)
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
    const newMob = interaction.options.getString('mob');

    if (!newLocation && !newMob) {
      return interaction.editReply('❌ 少なくともドロップ場所またはモブのいずれかを指定してください。');
    }

    // 既存のロケーション情報を取得
    const { data: existing } = await supabase
      .from('locations')
      .select('*')
      .eq('item_name', itemname)
      .eq('server', server)
      .single();

    if (!existing) {
      return interaction.editReply(`❌ \`${itemname}\` (${server}) のドロップ場所が登録されていません。`);
    }

    // 更新
    const updateData = {};
    if (newLocation) updateData.location = newLocation;
    if (newMob !== null) updateData.mob = newMob;

    const { error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('item_name', itemname)
      .eq('server', server);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 編集中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${itemname}\` (${server}) のドロップ場所を編集しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
