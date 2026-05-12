const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradelocation-add')
    .setDescription('アイテムの取引場所を登録する（管理者のみ）')
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
        .setDescription('取引場所（省略可）')
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
    const isAdmin = await checkAdmin(interaction.user.id);
    if (!isAdmin) {
      return interaction.reply({
        content: '❌ このコマンドは管理者のみ使用できます。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const itemname = interaction.options.getString('itemname');
    const server = interaction.options.getString('server');
    const location = interaction.options.getString('location') || '';

    // アイテム存在チェック
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('name', itemname)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${itemname}\` はitemsに登録されていません。先に /item-add で登録してください。`);
    }

    // 既存のトレードロケーション情報を取得
    const { data: existing } = await supabase
      .from('trade_locations')
      .select('*')
      .eq('item_name', itemname)
      .eq('server', server)
      .single();

    let error;
    if (existing) {
      // 更新
      const { error: updateError } = await supabase
        .from('trade_locations')
        .update({ location })
        .eq('item_name', itemname)
        .eq('server', server);
      error = updateError;
    } else {
      // 新規作成
      const { error: insertError } = await supabase
        .from('trade_locations')
        .insert({
          item_name: itemname,
          server,
          location,
        });
      error = insertError;
    }

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const action = existing ? '更新' : '登録';
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${itemname}\` の取引場所を${action}しました。\nサーバー: ${server}\n場所: ${location || '（指定なし）'}`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
