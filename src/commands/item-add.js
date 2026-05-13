const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

/**
 * Discord CDN URL → Supabase Storageへ保存
 */
async function uploadToStorage(discordUrl, bucket, filePath) {
  const res = await fetch(discordUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType =
    res.headers.get('content-type') || 'image/png';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-add')
    .setDescription('アイテムを登録する')

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
        .setDescription('Lore画像')
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
      opt.setName('description')
        .setDescription('説明')
        .setRequired(false)
    ),

  async execute(interaction) {
    const isAdmin = await checkAdmin(interaction.user.id);

    if (!isAdmin) {
      return interaction.reply({
        content: '❌ 管理者専用です。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({
      ephemeral: true,
    });

    const name = interaction.options.getString('name');

    const icon = interaction.options.getAttachment('icon');
    const lore = interaction.options.getAttachment('lore');

    const pveLevel =
      interaction.options.getInteger('pve_level');

    const location =
      interaction.options.getString('location');

    const tradelocation =
      interaction.options.getString('tradelocation');

    const description =
      interaction.options.getString('description');

    if (!icon.contentType?.startsWith('image/')) {
      return interaction.editReply(
        '❌ iconは画像を添付してください。'
      );
    }

    if (!lore.contentType?.startsWith('image/')) {
      return interaction.editReply(
        '❌ loreは画像を添付してください。'
      );
    }

    // 重複確認
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      return interaction.editReply(
        `❌ \`${name}\` は既に存在します。`
      );
    }

    let iconUrl;
    let loreUrl;

    try {
      const safeName = name.replace(
        /[^a-zA-Z0-9\-_]/g,
        '_'
      );

      iconUrl = await uploadToStorage(
        icon.url,
        'items',
        `${safeName}/icon.png`
      );

      loreUrl = await uploadToStorage(
        lore.url,
        'items',
        `${safeName}/lore.png`
      );
    } catch (err) {
      console.error('[UPLOAD ERROR]', err);

      return interaction.editReply(
        '❌ 画像アップロードに失敗しました。'
      );
    }

    const { error } = await supabase
      .from('items')
      .insert({
        name,

        icon_url: iconUrl,
        lore_url: loreUrl,

        pve_level: pveLevel ?? null,

        location: location || null,
        tradelocation: tradelocation || null,

        description: description || null,
      });

    if (error) {
      console.error(error);

      return interaction.editReply(
        '❌ DB登録に失敗しました。'
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({
        name,
        iconURL: iconUrl,
      })
      .setDescription(
        `✅ \`${name}\` を登録しました。`
      )
      .setImage(loreUrl)
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
