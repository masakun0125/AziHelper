const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-edit')
    .setDescription('アイテム情報を編集')

    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    )

    .addStringOption(opt =>
      opt.setName('newname')
        .setDescription('新しい名前')
        .setRequired(false)
    )

    .addIntegerOption(opt =>
      opt.setName('pve_level')
        .setDescription('必要PVEレベル')
        .setRequired(false)
        .setMinValue(0)
    )

    .addStringOption(opt =>
      opt.setName('location')
        .setDescription('入手場所')
        .setRequired(false)
    )

    .addStringOption(opt =>
      opt.setName('tradelocation')
        .setDescription('交易場所')
        .setRequired(false)
    )

    .addStringOption(opt =>
      opt.setName('craftlocation')
        .setDescription('クラフト場所')
        .setRequired(false)
    )

    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('説明')
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
      (items || []).map(i => ({
        name: i.name,
        value: i.name,
      }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply({
      ephemeral: true,
    });

    const isAdmin = await checkAdmin(interaction.user.id);

    if (!isAdmin) {
      return interaction.editReply('❌ 管理者専用コマンドです。');
    }

    const name = interaction.options.getString('name');

    const newName = interaction.options.getString('newname');

    const pveLevel = interaction.options.getInteger('pve_level');

    const location = interaction.options.getString('location');
    const tradelocation = interaction.options.getString('tradelocation');
    const craftlocation = interaction.options.getString('craftlocation');

    const description = interaction.options.getString('description');

    const { data: item } = await supabase
      .from('items')
      .select('*')
      .eq('name', name)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${name}\` は存在しません。`);
    }

    const updateData = {};

    if (newName) updateData.name = newName;

    if (pveLevel !== null) {
      updateData.pve_level = pveLevel;
    }

    if (location !== null) {
      updateData.location = location;
    }

    if (tradelocation !== null) {
      updateData.tradelocation = tradelocation;
    }

    if (craftlocation !== null) {
      updateData.craftlocation = craftlocation;
    }

    if (description !== null) {
      updateData.description = description;
    }

    if (Object.keys(updateData).length === 0) {
      return interaction.editReply('❌ 編集内容がありません。');
    }

    const { error } = await supabase
      .from('items')
      .update(updateData)
      .eq('name', name);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 編集に失敗しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${name}\` を編集しました。`)
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
