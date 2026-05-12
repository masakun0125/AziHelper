const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipe-edit')
    .setDescription('レシピを編集する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('itemname')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('ingredients')
        .setDescription('材料（JSON形式: [{"name":"アイテム名","count":数}]）')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
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
    await interaction.deferReply({ ephemeral: true });

    const isAdmin = await checkAdmin(interaction.user.id);
    if (!isAdmin) {
      return interaction.editReply({
        content: '❌ このコマンドは管理者のみ使用できます。',
      });
    }

    const itemname = interaction.options.getString('itemname');
    const ingredientsStr = interaction.options.getString('ingredients');

    // レシピ存在チェック
    const { data: recipe } = await supabase
      .from('recipes')
      .select('*')
      .eq('item_name', itemname)
      .single();

    if (!recipe) {
      return interaction.editReply(`❌ \`${itemname}\` のレシピが登録されていません。`);
    }

    if (!ingredientsStr) {
      return interaction.editReply('❌ 材料の情報を指定してください。');
    }

    // JSON パース
    let ingredients;
    try {
      ingredients = JSON.parse(ingredientsStr);
    } catch (e) {
      return interaction.editReply('❌ 材料のJSON形式が正しくありません。');
    }

    // 更新
    const { error } = await supabase
      .from('recipes')
      .update({ ingredients })
      .eq('item_name', itemname);

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 編集中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ \`${itemname}\` のレシピを編集しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
