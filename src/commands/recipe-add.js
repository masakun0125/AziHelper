const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

/**
 * Discord CDN → Supabase Storage
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

// ing1~ing9
function buildIngredientOptions(builder) {
  for (let i = 1; i <= 9; i++) {
    builder.addStringOption(opt => {
      opt.setName(`ing${i}`)
        .setDescription(`材料${i}（例: ダイヤ*2）`);

      if (i === 1) {
        opt.setRequired(true);
      }

      return opt;
    });
  }

  return builder;
}

module.exports = {
  data: buildIngredientOptions(
    new SlashCommandBuilder()
      .setName('recipe-add')
      .setDescription('レシピを登録する（管理者のみ）')

      .addStringOption(opt =>
        opt.setName('item_name')
          .setDescription('レシピ対象アイテム')
          .setRequired(true)
          .setAutocomplete(true)
      )

      .addAttachmentOption(opt =>
        opt.setName('grid')
          .setDescription('クラフト画像')
          .setRequired(true)
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
      (items || []).map(i => ({
        name: i.name,
        value: i.name,
      }))
    );
  },

  async execute(interaction) {
    const isAdmin = await checkAdmin(interaction.user.id);

    if (!isAdmin) {
      return interaction.reply({
        content: '❌ このコマンドは管理者専用です。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({
      ephemeral: true,
    });

    const itemName =
      interaction.options.getString('item_name');

    const grid =
      interaction.options.getAttachment('grid');

    if (!grid.contentType?.startsWith('image/')) {
      return interaction.editReply(
        '❌ gridは画像を添付してください。'
      );
    }

    // アイテム存在確認
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('name', itemName)
      .single();

    if (!item) {
      return interaction.editReply(
        `❌ \`${itemName}\` はitemsに存在しません。`
      );
    }

    // 材料取得
    const ingredients = [];

    for (let i = 1; i <= 9; i++) {
      const val =
        interaction.options.getString(`ing${i}`);

      if (!val) continue;

      const match =
        val.match(/^(.+)\*(\d+)$/);

      if (!match) {
        return interaction.editReply(
          `❌ ing${i} の形式が不正です。\n例: ダイヤ*2`
        );
      }

      ingredients.push({
        name: match[1].trim(),
        count: parseInt(match[2], 10),
      });
    }

    // 重複確認
    const { data: existing } = await supabase
      .from('recipes')
      .select('id')
      .eq('item_name', itemName)
      .single();

    if (existing) {
      return interaction.editReply(
        `❌ \`${itemName}\` のレシピは既に存在します。`
      );
    }

    let gridUrl;

    try {
      const safeName = itemName.replace(
        /[^a-zA-Z0-9\-_]/g,
        '_'
      );

      gridUrl = await uploadToStorage(
        grid.url,
        'items',
        `recipes/${safeName}.png`
      );
    } catch (err) {
      console.error('[UPLOAD ERROR]', err);

      return interaction.editReply(
        '❌ レシピ画像アップロードに失敗しました。'
      );
    }

    const { error } = await supabase
      .from('recipes')
      .insert({
        item_name: itemName,

        grid_image_url: gridUrl,

        ingredients,
      });

    if (error) {
      console.error(error);

      return interaction.editReply(
        '❌ レシピ登録に失敗しました。'
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(
        `✅ \`${itemName}\` のレシピを登録しました。\n材料: ${ingredients
          .map(i => `${i.name}×${i.count}`)
          .join(', ')}`
      )
      .setImage(gridUrl)
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
