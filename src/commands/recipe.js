const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const supabase = require('../lib/supabase');

// レシピEmbedとボタンを生成（ボタンハンドラからも使えるようにexport）
async function buildRecipeEmbed(itemName) {
  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('name', itemName)
    .single();

  if (!item) return null;

  const { data: recipe } = await supabase
    .from('recipes')
    .select('*')
    .eq('item_name', itemName)
    .single();

  if (!recipe) return { notFound: true };

  // 材料ごとにitemsに登録されているか確認
  const ingredientNames = recipe.ingredients.map(i => i.name);
  const { data: registeredItems } = await supabase
    .from('items')
    .select('name')
    .in('name', ingredientNames);

  const registeredSet = new Set((registeredItems || []).map(i => i.name));

  // 材料テキスト構築
  const ingredientLines = recipe.ingredients.map(ing => {
    const isRegistered = registeredSet.has(ing.name);
    // 登録済みアイテムには 🔗 マークを付ける（ボタンで対応）
    return isRegistered
      ? `🔗 **${ing.name}** × ${ing.count}`
      : `• ${ing.name} × ${ing.count}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setAuthor({ name: item.name, iconURL: item.icon_url })
    .setImage(recipe.grid_image_url)
    .addFields({
      name: '材料',
      value: ingredientLines.join('\n'),
    })
    .setTimestamp();

  // 登録済みアイテムのボタンを生成（最大5つ、1行に5つまでの制限）
  const linkedIngredients = recipe.ingredients.filter(ing => registeredSet.has(ing.name));
  const components = [];

  // 5つずつActionRowに分割（Discordの制限: 1行5ボタン、最大5行）
  for (let i = 0; i < linkedIngredients.length && i < 25; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = linkedIngredients.slice(i, i + 5);
    chunk.forEach(ing => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`recipe:${ing.name}`)
          .setLabel(`📋 ${ing.name}`)
          .setStyle(ButtonStyle.Secondary)
      );
    });
    components.push(row);
  }

  return { embed, components };
}

module.exports = {
  buildRecipeEmbed,

  data: new SlashCommandBuilder()
    .setName('recipe')
    .setDescription('レシピを表示する')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    // レシピが登録されているアイテムのみ候補に出す
    const { data: recipes } = await supabase
      .from('recipes')
      .select('item_name')
      .ilike('item_name', `%${focused}%`)
      .limit(25);

    await interaction.respond(
      (recipes || []).map(r => ({ name: r.item_name, value: r.item_name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply();

    const name = interaction.options.getString('name');
    const result = await buildRecipeEmbed(name);

    if (!result) {
      return interaction.editReply(`❌ \`${name}\` は登録されていません。`);
    }
    if (result.notFound) {
      return interaction.editReply(`❌ \`${name}\` のレシピはまだ登録されていません。`);
    }

    return interaction.editReply({ embeds: [result.embed], components: result.components });
  },
};
