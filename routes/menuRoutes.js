const menu = await Menu.findOneAndUpdate(
        {
          hostel,
          mealType,
          menuDate: normalizedDate,
        },
        {
          $set: {
            hostel,
            mealType,
            menuDate: normalizedDate,
            items: itemsList,
            status: 'published',
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
=======
      // Upsert: find and update or create
      const menu = await Menu.findOneAndUpdate(
        {
          hostel,
          mealType,
          menuDate: normalizedDate,
        },
        {
          $set: {
            hostel,
            mealType,
            menuDate: normalizedDate,
            day,
            items: itemsList,
            status: 'published',
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
