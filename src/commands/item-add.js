const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

/**
 * Discord CDN URLから画像をfetchしてSupabase Storageにアップロードし、
 * 永続的な公開URLを返す。
 */
async function uploadToStorage(discordUrl, bucket, filePath) {
  const res = await fetch(discordUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = res.headers.get('content-type') || 'image/png';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

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
        .setDescription('アイテムのアイコン画像')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('lore')
        .setDescription('アイテムのlore画像')
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
        .setDescription('アイテムの入手場所')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('tradelocation')
        .setDescription('アイテムの交易場所')
        .setRequired(false)
    ),

  async execute(interaction) {
    const isAdmin = await checkAdmin(interaction.user.id);
    if (!isAdmin) {
      return interaction.reply({
        content: '❌ このコマンドは管理者のみ使用できます。',
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

    if (!icon.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ iconは画像ファイルを添付してください。');
    }
    if (!lore.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ loreは画像ファイルを添付してください。');
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      return interaction.editReply(`❌ \`${name}\` はすでに登録されています。`);
    }

    // Supabase Storage にアップロード（Discord CDN URLは期限切れになるため）
    let iconUrl, loreUrl;
    try {
      const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
      iconUrl = await uploadToStorage(icon.url, 'items', `${safeName}/icon`);
      loreUrl = await uploadToStorage(lore.url, 'items', `${safeName}/lore`);
    } catch (err) {
      console.error('[Upload Error]', err);
      return interaction.editReply('❌ 画像のアップロード中にエラーが発生しました。Supabase StorageのバケットにPublicポリシーが設定されているか確認してください。');
    }

    const { error } = await supabase.from('items').insert({
      name,
      icon_url: iconUrl,
      lore_url: loreUrl,
      pve_level: pveLevel ?? null,
      location: location || null,
      tradelocation: tradelocation || null,
    });

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name, iconURL: iconUrl })
      .setDescription(`✅ \`${name}\` を登録しました。`)
      .setImage(loreUrl)
      .setTimestamp();

    if (pveLevel !== null) {
      embed.addFields({ name: '⚔️ 必要PVEレベル', value: String(pveLevel), inline: true });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
