const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('location-add')
    .setDescription('アイテムのドロップ場所を登録する（管理者のみ）')
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
        .setDescription('ドロップ場所')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mob')
        .setDescription('ドロップするモブ（省略可）')
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
    const location = interaction.options.getString('location');
    const mob = interaction.options.getString('mob') || null;

    // アイテム存在チェック
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('name', itemname)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${itemname}\` はitemsに登録されていません。先に /item-add で登録してください。`);
    }

    // 既存のロケーション情報を取得
    const { data: existing } = await supabase
      .from('locations')
      .select('*')
      .eq('item_name', itemname)
      .eq('server', server)
      .single();

    let error;
    if (existing) {
      // 更新
      const { error: updateError } = await supabase
        .from('locations')
        .update({ location, mob })
        .eq('item_name', itemname)
        .eq('server', server);
      error = updateError;
    } else {
      // 新規作成
      const { error: insertError } = await supabase
        .from('locations')
        .insert({
          item_name: itemname,
          server,
          location,
          mob,
        });
      error = insertError;
    }

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const action = existing ? '更新' : '登録';
    let description = `✅ \`${itemname}\` のドロップ場所を${action}しました。\nサーバー: ${server}\n場所: ${location}`;
    if (mob) {
      description += `\nモブ: ${mob}`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(description)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
