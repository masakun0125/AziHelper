const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('location')
    .setDescription('アイテムのドロップ場所を表示する')
    .addStringOption(opt =>
      opt.setName('itemname')
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

    const itemname = interaction.options.getString('itemname');

    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .eq('item_name', itemname)
      .order('server', { ascending: true });

    if (!locations || locations.length === 0) {
      return interaction.editReply(`❌ \`${itemname}\` のドロップ場所は登録されていません。`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📍 ${itemname} のドロップ場所`)
      .setTimestamp();

    const fields = locations.map(loc => {
      let value = `場所: ${loc.location}`;
      if (loc.mob) {
        value += `\nモブ: ${loc.mob}`;
      }
      return {
        name: `[${loc.server.toUpperCase()}]`,
        value,
        inline: false,
      };
    });

    embed.addFields(fields);

    return interaction.editReply({ embeds: [embed] });
  },
};
