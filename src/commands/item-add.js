const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-add')
    .setDescription('アイテムを登録する（管理者のみ）')

    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
    )

    .addAttachmentOption(opt =>
      opt.setName('icon')
        .setDescription('アイコン画像')
        .setRequired(true)
    )

    .addAttachmentOption(opt =>
      opt.setName('lore')
        .setDescription('lore画像')
        .setRequired(true)
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

  async execute(interaction) {
    const isAdmin = await checkAdmin(interaction.user.id);

    if (!isAdmin) {
      return interaction.reply({
        content: '❌ 管理者専用コマンドです。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');

    const icon = interaction.options.getAttachment('icon');
    const lore = interaction.options.getAttachment('lore');

    const pveLevel = interaction.options.getInteger('pve_level');

    const location = interaction.options.getString('location');
    const tradelocation = interaction.options.getString('tradelocation');
    const craftlocation = interaction.options.getString('craftlocation');

    const description = interaction.options.getString('description');

    if (!icon.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ iconは画像を添付してください。');
    }

    if (!lore.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ loreは画像を添付してください。');
    }

    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      return interaction.editReply(`❌ \`${name}\` は既に存在します。`);
    }

    const { error } = await supabase
      .from('items')
      .insert({
        name,

        -- Discord CDN URLを直接保存
        icon_url: icon.url,
        lore_url: lore.url,

        pve_level: pveLevel ?? null,

        location: location || null,
        tradelocation: tradelocation || null,
        craftlocation: craftlocation || null,

        description: description || null,
      });

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録に失敗しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({
        name,
        iconURL: icon.url,
      })
      .setDescription(`✅ \`${name}\` を登録しました。`)
      .setImage(lore.url)
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
