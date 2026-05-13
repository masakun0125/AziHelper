const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-edit')
    .setDescription('アイテム情報を編集する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('newname')
        .setDescription('新しいアイテム名（省略可）')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('pve_level')
        .setDescription('必要PVEレベル（省略可）')
        .setRequired(false)
        .setMinValue(0)
    )
    .addStringOption(opt =>
      opt.setName('location')
        .setDescription('入手場所（省略可）')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('tradelocation')
        .setDescription('交易場所（省略可）')
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

    const name = interaction.options.getString('name');
    const newName = interaction.options.getString('newname');
    const pveLevel = interaction.options.getInteger('pve_level');
    const location = interaction.options.getString('location');
    const tradelocation = interaction.options.getString('tradelocation');

    const { data: item } = await supabase
      .from('items')
      .select('*')
      .eq('name', name)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${name}\` は登録されていません。`);
    }

    const updateData = {};
    if (newName) updateData.name = newName;
    if (pveLevel !== null) updateData.pve_level = pveLevel;
    if (location !== null) updateData.location = location;
    if (tradelocation !== null) updateData.tradelocation = tradelocation;

    if (Object.keys(updateData).length === 0) {
      return interaction.editReply('❌ 更新する情報を指定してください。');
    }

    const { error } = await supabase
      .from('items')
      .update(updateData)
      .eq('name', name);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 編集中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${name}\` の情報を編集しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
