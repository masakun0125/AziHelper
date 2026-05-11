const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

// ing1~ing9のオプションを動的に生成するヘルパー
function buildIngredientOptions(builder) {
  for (let i = 1; i <= 9; i++) {
    builder.addStringOption(opt => {
      opt.setName(`ing${i}`)
        .setDescription(`材料${i}（例: ダイヤ*2）`);
      if (i === 1) opt.setRequired(true);
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
          .setDescription('レシピのアイテム名（登録済みのアイテム）')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addAttachmentOption(opt =>
        opt.setName('grid')
          .setDescription('クラフト台に配置した画像')
          .setRequired(false)
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

    const itemName = interaction.options.getString('item_name');
    const grid = interaction.options.getAttachment('grid');

    if (!grid.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ gridは画像ファイルを添付してください。');
    }

    // アイテム存在チェック
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('name', itemName)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${itemName}\` はitemsに登録されていません。先に /item-add で登録してください。`);
    }

    // ing1~ing9を収集
    const ingredients = [];
    for (let i = 1; i <= 9; i++) {
      const val = interaction.options.getString(`ing${i}`);
      if (!val) continue;

      // "アイテム名*個数" をパース
      const match = val.match(/^(.+)\*(\d+)$/);
      if (!match) {
        return interaction.editReply(`❌ ing${i} の形式が正しくありません。\`アイテム名*個数\` の形式で入力してください（例: ダイヤ*2）`);
      }
      ingredients.push({ name: match[1].trim(), count: parseInt(match[2], 10) });
    }

    // レシピ重複チェック
    const { data: existing } = await supabase
      .from('recipes')
      .select('id')
      .eq('item_name', itemName)
      .single();

    if (existing) {
      return interaction.editReply(`❌ \`${itemName}\` のレシピはすでに登録されています。`);
    }

    const { error } = await supabase.from('recipes').insert({
      item_name: itemName,
      grid_image_url: grid.url,
      ingredients,
    });

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${itemName}\` のレシピを登録しました。\n材料: ${ingredients.map(i => `${i.name}×${i.count}`).join(', ')}`)
      .setImage(grid.url)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
