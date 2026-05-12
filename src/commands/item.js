const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item')
    .setDescription('アイテム情報を表示する')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
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
    await interaction.deferReply();

    const name = interaction.options.getString('name');

    const { data: item } = await supabase
      .from('items')
      .select('*')
      .eq('name', name)
      .single();

    if (!item) {
      return interaction.editReply(`❌ \`${name}\` は登録されていません。`);
    }

    // レシピが存在するか確認
    const { data: recipe } = await supabase
      .from('recipes')
      .select('id')
      .eq('item_name', name)
      .single();

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: item.name, iconURL: item.icon_url })
      .setImage(item.lore_url)
      .setTimestamp();

    // location と tradelocation をフィールドとして追加
    const fields = [];
    if (item.location) {
      fields.push({
        name: '📍 入手場所',
        value: item.location,
        inline: false,
      });
    }
    if (item.tradelocation) {
      fields.push({
        name: '🏪 交易場所',
        value: item.tradelocation,
        inline: false,
      });
    }

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    const components = [];
    if (recipe) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`recipe:${name}`)
          .setLabel('📋 レシピを見る')
          .setStyle(ButtonStyle.Primary)
      );
      components.push(row);
    }

    return interaction.editReply({ embeds: [embed], components });
  },
};
